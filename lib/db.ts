// lib/mongodb.ts
import { MongoClient } from "mongodb";

const uri = "mongodb://root:r6pbm9mm@dbconn.sealoshzh.site:40906/?directConnection=true";

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // 用于在开发模式下防止多次创建连接
  // @ts-ignore
  var _mongoClientPromise: Promise<MongoClient>;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export default clientPromise;
