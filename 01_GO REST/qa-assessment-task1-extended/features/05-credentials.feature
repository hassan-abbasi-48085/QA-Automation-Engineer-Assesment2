# Covers readToken() in features/support/gorest.js. Runs offline: no token or network needed.
# Test-data cleanup is not a scenario. It is the After hook in features/support/world.js
# and runs after every scenario: it deletes each user the scenario created
# (204 or 404 counts as cleaned up) and, if the scenario already failed,
# only warns about cleanup errors so the original failure is the one reported.
@credentials
Feature: Credentials check
  As a tester
  I want a missing GoREST token to fail fast with a clear message
  So that I know how to fix the setup and no request is sent without a token

  Scenario: An unset token fails fast with a clear message
    When the token check runs with no token set
    Then it fails with a message containing "Missing credentials: the GOREST_TOKEN environment variable is not set."
    And no request is sent

  Scenario: A whitespace-only token is treated as missing
    When the token check runs with only whitespace as the token
    Then it fails with a message containing "Missing credentials"
    And no request is sent
