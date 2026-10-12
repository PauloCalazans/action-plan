/* global sap */
sap.ui.define(["sap/ushell/Container"], async function (Container) {
  "use strict";
  const oRenderer = await Container.createRendererInternal("fiori2", true);
  oRenderer.placeAt("content");
});
