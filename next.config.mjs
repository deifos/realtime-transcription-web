import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@huggingface/transformers": path.resolve(
        __dirname,
        "node_modules/@huggingface/transformers"
      ),
      sharp$: false,
      "onnxruntime-node$": false,
    };

    // Exclude binary files from being processed by webpack
    config.module = {
      ...config.module,
      exprContextCritical: false,
      rules: [
        ...config.module.rules,
        {
          test: /\.node$/,
          use: "node-loader",
          exclude: /node_modules/,
        },
      ],
    };

    return config;
  },
};

export default nextConfig;
