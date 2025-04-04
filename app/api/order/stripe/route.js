import Order from "@/models/Order";
import Product from "@/models/Product";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECREAT_KEY);

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const { address, items } = await request.json();
    const origin = request.headers.get("origin");

    if (!address || items.length === 0) {
      return NextResponse.json({ sucess: false, message: "Invalid data" });
    }

    let productData = [];

    const productPrices = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.product);
        productData.push({
          name: product.name,
          price: product.offerPrice,
          quantity: item.quantity,
        });
        return product.offerPrice * item.quantity;
      })
    );

    let amount = productPrices.reduce((acc, price) => acc + price, 0);

    amount += Math.floor(amount * 0.02);

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

    const order = await Order.create({
      userId,
      address,
      items,
      amount: amount + Math.floor(amount * 0.02),
      date: Date.now(),
      paymentType: "Stripe",
    });

    // create line items for stripe
    const line_items = productData.map((item) => {
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      };
    });

    // create session
    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: `${origin}/order-placed`,
      cancel_url: `${origin}/cart`,
      metadata: {
        orderId: order._id.toString(),
        userId,
      },
    });

    const url = session.url;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
