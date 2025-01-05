import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WebpackConfig {
  resolve: {
    alias: {
      [key: string]: string | boolean;
    };
  };
}

interface NextConfig {
  output: string;
  webpack: (config: WebpackConfig) => WebpackConfig;
}

const nextConfig: NextConfig = {
  output: "export",

  webpack: (config: WebpackConfig): WebpackConfig => {
    config.resolve.alias["@huggingface/transformers"] = path.resolve(
      __dirname,
      "node_modules/@huggingface/transformers"
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
