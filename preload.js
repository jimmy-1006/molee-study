const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("moleeDesktop", {
  platform: process.platform,
  isMac: process.platform === "darwin",
});
