import { inngest } from "@/config/inngest";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const { address, items } = await request.json();

    if (!address || items.length === 0) {
      return NextResponse.json({ sucess: false, message: "Invalid data" });
    }

    const productPrices = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.product);
        return product.offerPrice * item.quantity;
      })
    );

    const amount = productPrices.reduce((acc, price) => acc + price, 0);

    // await inngest.send({
    //   name: "order/created",
    //   data: {
    //     userId,
    //     address,
    //     items,
    //     amount: amount + Math.floor(amount * 0.02),
    //     date: Date.now(),
    //     paymentType: "COD",
    //   },
    // });

    await Order.create({
      userId,
      address,
      items,
      amount: amount + Math.floor(amount * 0.02),
      date: Date.now(),
      paymentType: "COD",
    });

    const user = await User.findById(userId);
    user.cartItems = {};
    await user.save();

    return NextResponse.json({ success: true, message: "Order placed" });
  } catch (error) {
    return NextResponse.json({ sucess: false, message: error.message });
  }
}
