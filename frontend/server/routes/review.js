const express = require("express");
const router = express.Router();
const reviewController = require("../controller/review");

router.get("/reviews/route/:routeKey", reviewController.getRouteReviews);
router.get("/reviews/user/:userId", reviewController.getUserReviews);
router.post("/reviews", reviewController.createReview);
router.put("/reviews/:id", reviewController.updateReview);
router.post("/reviews/:id/report", reviewController.reportReview);

module.exports = router;
