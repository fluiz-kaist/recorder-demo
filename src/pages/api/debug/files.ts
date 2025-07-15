// pages/api/debug/files.ts
import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cwd = process.cwd();
    const publicPath = path.join(cwd, "public");
    const dataPath = path.join(cwd, "public", "data");

    const info = {
      cwd,
      publicExists: fs.existsSync(publicPath),
      dataExists: fs.existsSync(dataPath),
      publicContents: fs.existsSync(publicPath)
        ? fs.readdirSync(publicPath)
        : [],
      dataContents: fs.existsSync(dataPath) ? fs.readdirSync(dataPath) : [],
    };

    res.json(info);
  } catch (error) {
    console.error("Debug API error:", error);
    res.status(500).json({
      error: String(error),
    });
  }
}
