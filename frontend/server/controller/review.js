const Review = require("../models/review");
const Booking = require("../models/booking");

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function computeRouteStats(reviews) {
  const visible = reviews.filter((r) => !r.isHidden);
  const totalReviews = visible.length;
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  if (totalReviews === 0) {
    return { averageRating: 0, totalReviews: 0, ratingBreakdown: breakdown };
  }

  let sum = 0;
  visible.forEach((r) => {
    const val = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
    sum += val;
    breakdown[val] = (breakdown[val] || 0) + 1;
  });

  return {
    averageRating: Math.round((sum / totalReviews) * 10) / 10,
    totalReviews,
    ratingBreakdown: breakdown,
  };
}

exports.getRouteReviews = async (req, res) => {
  try {
    const routeKey = String(req.params.routeKey || "").toLowerCase();
    const allReviews = await Review.find({ routeKey, isHidden: false })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const stats = computeRouteStats(allReviews);
    res.json({ routeKey, ...stats, reviews: allReviews });
  } catch (error) {
    console.error("Error fetching route reviews:", error);
    res.status(500).json({ error: "Failed to load route reviews" });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const reviews = await Review.find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ error: "Failed to load user reviews" });
  }
};

exports.createReview = async (req, res) => {
  try {
    const {
      routeKey,
      departureCity,
      arrivalCity,
      busId,
      operatorName,
      bookingId,
      userId,
      userName,
      rating,
      comment,
      journeyDate,
    } = req.body;

    if (!routeKey || !bookingId || !userId || !userName) {
      return res.status(400).json({ error: "Missing required review fields" });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const trimmedComment = String(comment || "").trim();
    if (trimmedComment.length < 20) {
      return res.status(400).json({ error: "Review must be at least 20 characters" });
    }

    // Verify completed journey (check booking status or past journey date)
    let bookingCompleted = false;
    try {
      const booking = await Booking.findById(bookingId).lean().exec();
      if (booking && String(booking.customerId) === String(userId)) {
        const depDate = booking.departureDetails?.date;
        const isPast = depDate ? new Date(depDate).getTime() < Date.now() : false;
        bookingCompleted = booking.status === "completed" || isPast;
      }
    } catch {
      bookingCompleted = journeyDate ? new Date(journeyDate).getTime() <= Date.now() : false;
    }

    if (!bookingCompleted) {
      return res.status(403).json({
        error: "Reviews can only be submitted after a completed journey",
      });
    }

    // Enforce one review per user per journey
    const existing = await Review.findOne({ userId, bookingId }).lean().exec();
    if (existing) {
      return res.status(409).json({
        error: "You have already reviewed this journey",
      });
    }

    const created = await Review.create({
      routeKey: String(routeKey).toLowerCase(),
      departureCity,
      arrivalCity,
      busId,
      operatorName,
      bookingId,
      userId,
      userName,
      rating: numericRating,
      comment: trimmedComment,
      journeyDate: journeyDate || new Date().toISOString().split("T")[0],
    });

    const visibleReviews = await Review.find({
      routeKey: String(routeKey).toLowerCase(),
      isHidden: false,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.status(201).json({
      review: created,
      ...computeRouteStats(visibleReviews),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "You have already reviewed this journey" });
    }
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, rating, comment } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (String(review.userId) !== String(userId)) {
      return res.status(403).json({ error: "You can only edit your own review" });
    }

    const elapsed = Date.now() - new Date(review.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Reviews can only be edited within 24 hours" });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const trimmedComment = String(comment || "").trim();
    if (trimmedComment.length < 20) {
      return res.status(400).json({ error: "Review must be at least 20 characters" });
    }

    review.rating = numericRating;
    review.comment = trimmedComment;
    review.editedAt = new Date();
    await review.save();

    const visibleReviews = await Review.find({
      routeKey: review.routeKey,
      isHidden: false,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.json({
      review,
      ...computeRouteStats(visibleReviews),
    });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
};

exports.reportReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, reason } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    const reporter = userId || "anonymous";
    if (!review.reportedBy.includes(reporter)) {
      review.reportedBy.push(reporter);
      review.reportCount += 1;
    }
    if (reason) {
      review.reportReasons.push(String(reason));
    }

    // Hide flagged review immediately and recalculate average rating
    review.isHidden = true;
    await review.save();

    const visibleReviews = await Review.find({
      routeKey: review.routeKey,
      isHidden: false,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    res.json({
      hidden: true,
      reviewId: id,
      ...computeRouteStats(visibleReviews),
    });
  } catch (error) {
    console.error("Error reporting review:", error);
    res.status(500).json({ error: "Failed to report review" });
  }
};
