# Mirrors: test/04-lifecycle.spec.js
@lifecycle @requires-token
Feature: User lifecycle and response format
  As an API consumer
  I want to read, update and delete a user I created
  So that the full user lifecycle behaves as documented

  Background:
    Given the base URL is "https://gorest.co.in/public/v2"
    And a valid bearer token is read from the "GOREST_TOKEN" environment variable

  Scenario: GET /users/{id} returns JSON with exactly id, name, email, gender and status
    Given a user was created
    When I send a GET request to "/users/{created user ID}"
    Then the response status should be 200
    And the "Content-Type" header should match "application/json"
    And the response body should have exactly the keys:
      | id     |
      | name   |
      | email  |
      | gender |
      | status |

  Scenario: PATCH /users/{id} updates the user and GET returns the new values
    Given a user was created with status "active"
    When I send a PATCH request to "/users/{created user ID}" that appends " Updated" to the name and sets status to "inactive"
    Then the response status should be 200
    And the response should contain the updated name and status
    And the response id, email and gender should be unchanged
    When I send a GET request to "/users/{created user ID}"
    Then the response status should be 200
    And the response should contain the updated name and status

  Scenario: DELETE /users/{id} returns 204, then GET and a second DELETE return 404
    Given a user was created
    When I send a DELETE request to "/users/{created user ID}"
    Then the response status should be 204
    And the user is removed from cleanup tracking
    When I send a GET request to "/users/{created user ID}"
    Then the response status should be 404
    And the response body should have a non-empty string "message"
    When I send a DELETE request to "/users/{created user ID}" again
    Then the response status should be 404
