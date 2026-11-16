'use strict';

// Step definitions for every .feature file in features/.

const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const api = require('../support/gorest');

const columnValues = (table) => table.raw().map((row) => row[0]);

// ---------------------------------------------------------------- Setup ----

Given('the base URL is {string}', function (url) {
  this.baseUrl = url.replace(/\/+$/, '');
});

Given('a valid bearer token is read from the {string} environment variable', function (name) {
  this.token = api.readToken(process.env[name]);
});

Given('a user payload with a unique name and email, a valid gender and a valid status', function () {
  this.payload = api.buildUserPayload();
});

Given('a valid user payload with a unique email', function () {
  this.payload = api.buildUserPayload();
});

Given('a user was created', async function () {
  await this.createUser();
});

Given('a user was created with the user payload', async function () {
  await this.createUser(this.payload);
});

Given('a user was created with status {string}', async function (status) {
  await this.createUser(api.buildUserPayload({ status }));
});

Given('a user already exists with a unique email', async function () {
  await this.createUser();
});

// ------------------------------------------------------------- Requests ----

When('I send a POST request to {string} with the user payload', async function (path) {
  const res = await this.send('POST', path, { body: this.payload });
  this.track(res.body);
});

When('I send a POST request to {string} with the user payload and no Authorization header', async function (path) {
  const res = await this.send('POST', path, { body: this.payload, token: null });
  this.track(res.body); // only matters if the API wrongly creates a user
});

When(
  'I send a POST request to {string} with the user payload and the bearer token {string}',
  async function (path, token) {
    const res = await this.send('POST', path, { body: this.payload, token });
    this.track(res.body);
  }
);

When('I send a POST request to {string} with a valid payload using the same email', async function (path) {
  this.payload = api.buildUserPayload({ email: this.createdUser.email });
  const res = await this.send('POST', path, { body: this.payload });
  this.track(res.body);
});

When(
  'I send a POST request to {string} with a valid payload where {string} is {string}',
  async function (path, field, value) {
    this.payload = api.buildUserPayload({ [field]: value });
    const res = await this.send('POST', path, { body: this.payload });
    this.track(res.body);
  }
);

When('I send a POST request to {string} with an empty JSON body', async function (path) {
  this.payload = {};
  const res = await this.send('POST', path, { body: this.payload });
  this.track(res.body);
});

When('I send a GET request to {string}', async function (path) {
  await this.send('GET', path);
});

When(
  'I send a PATCH request to {string} that appends {string} to the name and sets status to {string}',
  async function (path, suffix, status) {
    this.changes = { name: `${this.createdUser.name}${suffix}`, status };
    await this.send('PATCH', path, { body: this.changes });
  }
);

When('I send a DELETE request to {string}', async function (path) {
  await this.send('DELETE', path);
});

When('I send a DELETE request to {string} again', async function (path) {
  await this.send('DELETE', path);
});

// ----------------------------------------------------- Response checks ----

Then('the response status should be {int}', function (status) {
  const label = 'Last request';
  expect(this.response.status, api.describeResponse(label, this.response)).to.equal(status);
});

Then('the response body should be a JSON object', function () {
  expect(this.response.body, 'response body').to.be.an('object').and.not.an('array');
});

Then('the response {string} should be a positive integer', function (field) {
  const value = this.response.body[field];
  expect(Number.isInteger(value) && value > 0, `${field} ${value} is a positive integer`).to.equal(true);
});

Then('I store the response {string} as the created user ID', function (field) {
  this.createdUser = this.response.body;
  this.createdUserId = this.response.body[field];
});

Then('the created user is tracked for cleanup', function () {
  expect(this.cleanupIds.has(this.createdUserId), 'created user is tracked for cleanup').to.equal(true);
});

Then('the response body should contain the keys:', function (table) {
  expect(this.response.body).to.be.an('object').that.includes.all.keys(...columnValues(table));
});

Then('the response body should have exactly the keys:', function (table) {
  expect(this.response.body).to.be.an('object').that.has.all.keys(...columnValues(table));
});

Then('the response {string} should equal the created user ID', function (field) {
  expect(this.response.body[field], field).to.equal(this.createdUserId);
});

Then('the response fields should match the submitted payload:', function (table) {
  for (const field of columnValues(table)) {
    expect(this.response.body[field], field).to.equal(this.payload[field]);
  }
});

Then('the response body should have a non-empty string {string}', function (field) {
  expect(this.response.body).to.be.an('object').with.property(field).that.is.a('string').and.not.empty;
});

Then('no user should be created', function () {
  const body = this.response.body;
  const id = body && typeof body === 'object' ? body.id : undefined;
  expect(id, 'a user id in the response means a user was created').to.equal(undefined);
});

Then('the {string} header should match {string}', function (header, expected) {
  expect(header.toLowerCase(), 'only Content-Type is captured').to.equal('content-type');
  expect(this.response.contentType, header).to.include(expected);
});

Then('the response should contain the updated name and status', function () {
  expect(this.response.body).to.include({ id: this.createdUserId, ...this.changes });
});

Then('the response id, email and gender should be unchanged', function () {
  const { id, email, gender } = this.createdUser;
  expect(this.response.body).to.include({ id, email, gender });
});

Then('the user is removed from cleanup tracking', function () {
  this.cleanupIds.delete(this.createdUserId);
});

// ----------------------------------------------------- Validation (422) ----

Then('the response body should be a non-empty array of errors', function () {
  expect(this.response.body, 'error body').to.be.an('array').that.is.not.empty;
});

Then('every error should have a non-empty {string}', function (key) {
  this.response.body.forEach((e) => expect(e[key], `${key} for ${e.field}`).to.be.a('string').and.not.empty);
});

Then('the error fields should include {string}', function (field) {
  expect(api.errorFields(this.response.body)).to.include(field);
});

Then('the error fields should include:', function (table) {
  expect(api.errorFields(this.response.body)).to.include.members(columnValues(table));
});

// ---------------------------------------------------------- Credentials ----

When('the token check runs with no token set', function () {
  try {
    api.readToken('');
    this.tokenError = undefined;
  } catch (err) {
    this.tokenError = err;
  }
});

When('the token check runs with only whitespace as the token', function () {
  try {
    api.readToken('   ');
    this.tokenError = undefined;
  } catch (err) {
    this.tokenError = err;
  }
});

Then('it fails with a message containing {string}', function (text) {
  expect(this.tokenError, 'token check should throw').to.be.an('error');
  expect(this.tokenError.message).to.include(text);
});

Then('no request is sent', function () {
  expect(this.requestCount).to.equal(0);
});
