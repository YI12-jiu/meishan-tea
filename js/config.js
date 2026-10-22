/* ==========================================================================
   全局命名空间（必须最先初始化，视图文件依赖它）
   ========================================================================== */
window.TEA_DATA = window.TEA_DATA || {};
window.VIEWS = window.VIEWS || {};
window.APP = window.APP || { user: null, session: null, authReady: false };

/* ==========================================================================
   云服务公开配置
   来源：WorkBuddy 云服务开通结果 publicConfig（仅这三个字段可安全下发到前端）
   publishableKey 只用于标识应用，权限由服务端按 Origin 精确校验
   ========================================================================== */
window.CLOUD_CONFIG = {
  mode: "auto", // auto: only the configured endpoint origin; enabled: explicitly authorized alternate origin
  sdkUrl: "vendor/workbuddy-cloud-sdk/index.global.js?v=0e1ab581",
  endpoint: "https://meishan-tea.app.workbuddy.host",
  publishableKey:
    "wbpk_hZYQ5RWfEjI33EIJ3tVM25_LO2ALDjFTTILo9Ggbeh6ieW5PMcPVpba",
};
