/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // useSearchParams() em páginas dinâmicas com auth não precisa de Suspense aqui:
    // toda página atrás de middleware já é dynamic, sem chance de SSG. Esta flag
    // restaura o comportamento pré-14.2 (warning ao invés de erro de build).
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
