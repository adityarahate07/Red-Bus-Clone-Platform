const CommunityPost = require("../models/community-post");

const VALID_TOPICS = ["Routes", "Destinations", "Travel Advice"];

exports.getPosts = async (req, res) => {
  try {
    const { topic, authorId, includeModerated } = req.query;
    const filter = {};

    if (topic && VALID_TOPICS.includes(topic)) {
      filter.topic = topic;
    }
    if (authorId) {
      filter.authorId = authorId;
    }
    if (includeModerated !== "true") {
      filter.status = { $ne: "hidden" };
    }

    const posts = await CommunityPost.find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    res.json(posts);
  } catch (error) {
    console.error("Error loading community posts:", error);
    res.status(500).json({ error: "Failed to load community posts" });
  }
};

exports.createPost = async (req, res) => {
  try {
    const {
      authorId,
      authorName,
      authorEmail,
      authorVerified,
      title,
      content,
      topic,
      routeTag,
      travelTips,
      photoUrl,
    } = req.body;

    if (!authorId || !authorName || authorVerified === false) {
      return res.status(403).json({ error: "Only verified users can publish community stories" });
    }
    if (!title || !String(title).trim() || !content || !String(content).trim()) {
      return res.status(400).json({ error: "Title and story content are required" });
    }
    if (!VALID_TOPICS.includes(topic)) {
      return res.status(400).json({ error: "Invalid discussion topic" });
    }

    const post = await CommunityPost.create({
      authorId,
      authorName,
      authorEmail,
      authorVerified: true,
      title: String(title).trim(),
      content: String(content).trim(),
      topic,
      routeTag: routeTag ? String(routeTag).trim() : "",
      travelTips: Array.isArray(travelTips)
        ? travelTips.map((t) => String(t).trim()).filter(Boolean)
        : [],
      photoUrl: photoUrl ? String(photoUrl).trim() : "",
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating community post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const idx = post.likes.indexOf(userId);
    if (idx === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(idx, 1);
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: "Failed to update like" });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, text } = req.body;

    if (!userId || !userName || !text || !String(text).trim()) {
      return res.status(400).json({ error: "Comment text and user info are required" });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.comments.push({
      userId,
      userName,
      text: String(text).trim(),
      createdAt: new Date(),
    });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

exports.reportPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, reason } = req.body;

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.reports.push({
      userId: userId || "anonymous",
      userName: userName || "Traveler",
      reason: String(reason || "Inappropriate content"),
      createdAt: new Date(),
    });

    if (post.status !== "hidden") {
      post.status = "flagged";
    }
    await post.save();
    res.json(post);
  } catch (error) {
    console.error("Error reporting post:", error);
    res.status(500).json({ error: "Failed to report post" });
  }
};

exports.moderatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (action === "remove") {
      const deleted = await CommunityPost.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: "Post not found" });
      }
      return res.json({ removed: true, id });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (action === "approve") {
      post.status = "published";
      post.reports = [];
    } else if (action === "hide") {
      post.status = "hidden";
    } else {
      return res.status(400).json({ error: "Invalid moderation action" });
    }

    await post.save();
    res.json(post);
  } catch (error) {
    console.error("Error moderating post:", error);
    res.status(500).json({ error: "Failed to moderate post" });
  }
};
