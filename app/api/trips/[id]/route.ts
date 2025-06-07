import { NextResponse } from "next/server"
import clientPromise from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tripId = Number(await params.id); // 👈 转成数字，前端传的是 '1'
  console.log("tripId", tripId);

  const client = await clientPromise;
  const db = client.db("trip");
  const collection = db.collection("Trips");

  // 根据 id 查找
  const trip = await collection.findOne({ id: tripId });

  if (!trip) {
    return NextResponse.json({ message: "行程未找到" }, { status: 404 });
  }

  return NextResponse.json(trip);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const updateData = await request.json()
    const tripId = params.id

    const updatedTrip = {
      ...updateData,
      id: tripId,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(updatedTrip)
  } catch (error) {
    return NextResponse.json({ message: "更新行程失败" }, { status: 500 })
  }
}
