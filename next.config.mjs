/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  allowedDevOrigins: ['10.72.12.223', 'resikin.hanavy.online', '*.ngrok-free.dev'],
};

export default nextConfig;
