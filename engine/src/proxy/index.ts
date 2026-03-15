// PrivGuard Proxy — Public API
export { startProxy, type ProxyConfig } from './server.js';
export { detectAgents, configureAll, unconfigureAll, detectUpstreamUrl, type AgentInfo, type ConfigureResult } from './config.js';
export { setup, teardown, type SetupOptions, type SetupResult } from './setup.js';
export { detectFormat, extractRequestTexts, extractResponseTexts, type ApiFormat } from './adapters.js';
