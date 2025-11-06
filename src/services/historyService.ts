import mongoose from "mongoose";

// Define History schema
const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["PR", "CODE_REVIEW", "SCRIPT_GEN", "VALIDATION"],
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create History model
const History = mongoose.model("History", historySchema);

// Get user's interaction history
export const getHistory = async (userId: string) => {
  return await History.find({ userId }).sort({ timestamp: -1 }).limit(100);
};

// Clear user's history
export const clearHistory = async (userId: string) => {
  await History.deleteMany({ userId });
};

// Add history entry
export const addHistoryEntry = async (
  userId: string,
  type: string,
  details: any
) => {
  const historyEntry = new History({
    userId,
    type,
    details,
  });

  await historyEntry.save();
  return historyEntry;
};

export default {
  getHistory,
  clearHistory,
  addHistoryEntry,
};
