const diff = require('recursive-diff');
const _ = require('lodash');
const Promise = require('bluebird');
const draftModel = require('./model');

module.exports = (schema, opts = {}) => {
  const { modelName } = opts;

  schema.add({ draft_status: { type: String, enum: ['pending', 'done'] } });

  schema.pre('save', function saveHook(next) {
    this.draft_status = 'pending';
    next();
  });

  const diffMethod = (proto = {}, doc) => {
    const change = {};
    const different = diff.getDiff(proto, doc);

    const keys = Object.keys(different).map(v => {
      const arr = v.split('/');
      arr.shift();
      return arr.join('.');
    });
    keys.forEach(k => {
      change[k] = { old: _.get(proto, k), new: _.get(doc, k) };
      (change[k].old === undefined) && delete change[k].old;
      (change[k].new === undefined) && delete change[k].new;
    });
    return change;
  };

  schema.methods.saveDraft = async function saveDraft() {
    const model = this.constructor;
    const id = this._id;
    const [draft, doc] = await Promise.all([
      draftModel.findOne({ model_id: id, model: modelName, status: 'pending' }),
      model.findById(id)
    ]);

    if (draft) {
      return Promise.reject(new Error('draft exist'));
    }
    // console.log('doc: ', doc);
    // console.log(this.toObject());
    return draftModel.create({
      model_id: id,
      model: modelName,
      changes: diffMethod(doc && doc.toObject() || {}, this.toObject()),
      status: 'pending'
    });
  };

  schema.methods.updateDraft = function updateDraft(extra) {
    return draftModel.update({ model_id: this._id, model: modelName, status: 'pending' }, { extra });
  };

  schema.methods.applyDraft = async function applyDraft() {
    const id = this._id;
    const model = this.constructor;
    const draft = await draftModel.findOne({ model_id: id, model: modelName, status: 'pending' });

    if (!draft) return Promise.reject(new Error('no pending draft found'));

    const cond = { model_id: id, model: modelName, status: 'pending' };
    await draftModel.update(cond, { status: 'done' });
    const [doc] = await this.draft().find({ model_id: id }).sort({ _id: -1 }).limit(1);

    const d = {};
    Object.keys(doc.changes).forEach(k => {
      d[k] = doc.changes[k].new;
    });
    // console.log(this);
    // console.log(d);
    return model.update({ _id: id }, Object.assign(this.toObject(), d), { upsert: true });
  };

  // schema.methods.findDraft = function findDraft(cond) {
  //   return draftModel.find(Object.assign(cond, { model: modelName }));
  // };

  schema.methods.draft = function draft() { // use model.draft().find()
    return draftModel;
  };

  schema.methods.findPendingDraft = function findPendingDraft() {
    return draftModel.findOne({ model_id: this._id, model: modelName, status: 'pending' });
  };

  schema.methods.discardDraft = async function discardDraft() {
    const model = this.constructor;
    const id = this._id;

    await Promise.all([
      model.update({ _id: id }, { draft_status: 'done' }),
      draftModel.remove({ model_id: id, model: modelName, status: 'pending' })
    ]);
  };
};