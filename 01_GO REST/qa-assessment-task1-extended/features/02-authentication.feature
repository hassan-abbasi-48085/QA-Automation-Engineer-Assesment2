# Mirrors: test/02-authentication.spec.js
# These scenarios deliberately send no token or a wrong one, so they run without GOREST_TOKEN.
@auth @negative
Feature: Authentication on POST /users
  As the API owner
  I want unauthenticated create requests to be rejected
  So that only authorised clients can create users

  Background:
    Given the base URL is "https://gorest.co.in/public/v2"
    And a valid user payload with a unique email

  Scenario: POST /users without a token returns 401 and creates nothing
    When I send a POST request to "/users" with the user payload and no Authorization header
    Then the response status should be 401
    And the response body should have a non-empty string "message"
    And no user should be created

  Scenario: POST /users with an invalid token returns 401
    When I send a POST request to "/users" with the user payload and the bearer token "invalid-token-for-negative-test"
    Then the response status should be 401
    And the response body should have a non-empty string "message"
