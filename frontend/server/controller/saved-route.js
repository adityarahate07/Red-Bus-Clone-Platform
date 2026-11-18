const SavedRoute = require("../models/saved-route");

exports.getUserSavedRoutes = async (req, res) => {
  try {
    const { userId } = req.params;
    const routes = await SavedRoute.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    res.json(routes);
  } catch (error) {
    console.error("Error fetching saved routes:", error);
    res.status(500).json({ error: "Failed to load saved routes" });
  }
};

exports.createSavedRoute = async (req, res) => {
  try {
    const {
      userId,
      name,
      startCity,
      destinationCity,
      waypoints,
      preferredRouteId,
      distanceKm,
      estimatedMinutes,
      trafficLevel,
    } = req.body;

    if (!userId || !name || !startCity || !destinationCity) {
      return res.status(400).json({ error: "Missing required route fields" });
    }

    const created = await SavedRoute.create({
      userId,
      name: String(name).trim(),
      startCity,
      destinationCity,
      waypoints: Array.isArray(waypoints) ? waypoints : [],
      preferredRouteId: preferredRouteId || "",
      distanceKm: Number(distanceKm) || 0,
      estimatedMinutes: Number(estimatedMinutes) || 0,
      trafficLevel: ["Low", "Moderate", "Heavy"].includes(trafficLevel)
        ? trafficLevel
        : "Low",
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("Error saving route:", error);
    res.status(500).json({ error: "Failed to save route" });
  }
};

exports.deleteSavedRoute = async (req, res) => {
  try {
    const { id } = req.params;
    await SavedRoute.findByIdAndDelete(id).exec();
    res.json({ deleted: true, id });
  } catch (error) {
    console.error("Error deleting saved route:", error);
    res.status(500).json({ error: "Failed to delete saved route" });
  }
};
