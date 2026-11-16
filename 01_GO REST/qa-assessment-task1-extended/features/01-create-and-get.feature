# Mirrors: test/01-create-and-get.spec.js
@task1 @smoke @requires-token
Feature: Create a user and retrieve it by ID
  As an API consumer
  I want to create a user with POST /public/v2/users
  So that I can retrieve the same user with GET /public/v2/users/{id}

  Background:
    Given the base URL is "https://gorest.co.in/public/v2"
    And a valid bearer token is read from the "GOREST_TOKEN" environment variable
    And a user payload with a unique name and email, a valid gender and a valid status

  Scenario: POST /users creates a user and returns HTTP 201 with an ID
    When I send a POST request to "/users" with the user payload
    Then the response status should be 201
    And the response body should be a JSON object
    And the response "id" should be a positive integer
    And I store the response "id" as the created user ID
    And the created user is tracked for cleanup

  Scenario: GET /users/{id} returns HTTP 200 and the submitted values
    Given a user was created with the user payload
    When I send a GET request to "/users/{created user ID}"
    Then the response status should be 200
    And the response body should contain the keys:
      | id     |
      | name   |
      | email  |
      | gender |
      | status |
    And the response "id" should be a positive integer
    And the response "id" should equal the created user ID
    And the response fields should match the submitted payload:
      | name   |
      | email  |
      | gender |
      | status |
