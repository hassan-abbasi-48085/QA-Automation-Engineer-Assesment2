# Mirrors: test/03-validation.spec.js
@validation @negative @requires-token
Feature: Input validation on POST /users (HTTP 422)
  As the API owner
  I want invalid user data to be rejected with field-level errors
  So that only valid users are stored

  Background:
    Given the base URL is "https://gorest.co.in/public/v2"
    And a valid bearer token is read from the "GOREST_TOKEN" environment variable

  Rule: Every 422 response is a non-empty array of field and message errors

    Scenario: Reject an email that is already taken
      Given a user already exists with a unique email
      When I send a POST request to "/users" with a valid payload using the same email
      Then the response status should be 422
      And the response body should be a non-empty array of errors
      And every error should have a non-empty "message"
      And the error fields should include "email"

    Scenario Outline: Reject an invalid <field>
      When I send a POST request to "/users" with a valid payload where "<field>" is "<invalid value>"
      Then the response status should be 422
      And the response body should be a non-empty array of errors
      And every error should have a non-empty "message"
      And the error fields should include "<field>"

      Examples:
        | field  | invalid value |
        | email  | not-an-email  |
        | gender | unknown       |
        | status | pending       |

    Scenario: Reject an empty body with an error for every required field
      When I send a POST request to "/users" with an empty JSON body
      Then the response status should be 422
      And the response body should be a non-empty array of errors
      And every error should have a non-empty "message"
      And the error fields should include:
        | name   |
        | email  |
        | gender |
        | status |
