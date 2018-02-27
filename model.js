const mongoose = require('mongoose');

// mongoose.set('debug', true);
const { Schema } = mongoose;
const { Types: { ObjectId, Mixed } } = Schema;

const schema = new Schema({
  model_id: { type: ObjectId },
  model: { type: String },
  changes: { type: Mixed },
  extra: { type: Mixed },
  status: { type: String, enum: ['pending', 'done'] }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('draft', schema);