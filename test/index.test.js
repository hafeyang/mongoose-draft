const { test } = require('ava');
const mongoose = require('mongoose');
const draft = require('../index');
const draftModel = require('../model');

const { Schema } = mongoose;

mongoose.connect('mongodb://localhost:27017/draft');

const schema = new Schema({
  name: String,
  age: Number,
});

const opts = { modelName: 'person' };

schema.plugin(draft, opts);

const Person = mongoose.model('person', schema);

test.after(async () => {
  await Promise.all([
    Person.remove(),
    draftModel.remove()
  ]);
});

test('saveDraft and applyDraft', async (t) => {
  const doc = { name: 'ada', age: 23 };
  const deep = {
    a: {
      a: 'hello', b: [1, 2], c: 'delete me', d: { c1: 20, c2: { c21: 'hello' } }
    },
    b: {
      a: 'good', b: [3, 4, 5], d: { c: 20, c2: { c21: 'hi', c22: 'welcome' } }, e: 'new property'
    }
  };

  const person = new Person(doc);
  // person.deep = deep.a;
  const id = person._id;

  await person.saveDraft();
  const item = await person.findPendingDraft();
  // console.log(item);
  t.truthy(item);
  await person.updateDraft({ t: 2 });
  const item2 = await person.findPendingDraft();
  t.is(item2.extra.t, 2);
  await person.applyDraft();
  const [item3] = await person.draft().find({ model_id: id });
  // console.log(item3);
  t.is(item3.status, 'done');

  const p = await Person.findById(id);
  // p.deep = deep.b;
  // console.log(p);
  t.is(p.age, doc.age);
  t.is(p.name, doc.name);

  p.age = 20;

  await p.saveDraft();
  const item4 = await p.findPendingDraft();
  // console.log(item4);
  t.is(item4.status, 'pending');

  p.age = 40; // no side effect
  await p.applyDraft();

  const [item5] = await person.draft().find({ model_id: id }).sort({ _id: -1 }).limit(1);
  // console.log(item5);
  t.is(item5.status, 'done');
  const p2 = await Person.findById(id);
  // console.log(p2);
  t.is(p2.age, 20);

  await p2.discardDraft();

  const [p3, item6] = await Promise.all([
    Person.findById(id),
    p2.findPendingDraft()
  ]);
  // console.log(p3);
  // console.log(item6);
  t.is(p3.draft_status, 'done');
  t.falsy(item6);
});