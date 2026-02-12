const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("mustudio", {
  platform: process.platform,
});
