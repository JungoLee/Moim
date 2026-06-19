import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, default: '' },
    memo: { type: String, default: '' },
    // default : 친구 등급(close/normal)에 따라 노출
    // private : close 친구에게도 "바쁨"으로만 노출
    visibility: { type: String, enum: ['default', 'private'], default: 'default' },
  },
  { timestamps: true }
);

eventSchema.index({ owner: 1, start: 1 });

export default mongoose.model('Event', eventSchema);
