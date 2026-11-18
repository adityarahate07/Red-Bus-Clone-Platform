const express = require("express");
const router = express.Router();
const savedRouteController = require("../controller/saved-route");

router.get("/saved-routes/user/:userId", savedRouteController.getUserSavedRoutes);
router.post("/saved-routes", savedRouteController.createSavedRoute);
router.delete("/saved-routes/:id", savedRouteController.deleteSavedRoute);

module.exports = router;
