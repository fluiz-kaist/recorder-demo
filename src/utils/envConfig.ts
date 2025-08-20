export const getEnv = () => {
  const env = process.env.NEXT_PUBLIC_ENV || "production"; // 기본값
  return {
    isPreview: env === "preview",
    isProduction: env === "production",
    isDev: env === "development",
  };
};

export const isDevelopment = (): boolean => {
  return getEnv().isDev;
};

export const canAccessProductionData = (): boolean => {
  return getEnv().isDev && process.env.ENABLE_PRODUCTION_COPY === "true";
};
