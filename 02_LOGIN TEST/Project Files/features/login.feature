@login
Feature: Login on the Practice Test Automation site
  As a user of the practice site
  I want to log in with my username and password
  So that I can reach the secured page, and be refused with a clear message when my details are wrong

  Site: https://practicetestautomation.com/practice-test-login/
  The credentials student / Password123 are public demo credentials published on the page.

  Background:
    Given I open the login page

  @TC-LOGIN-01 @primary @smoke @positive
  Scenario: TC-LOGIN-01 Successful login with valid credentials
    When I log in with username "student" and password "Password123"
    Then I am logged in as "student"

  @negative
  Scenario Outline: <id> Login is rejected: <case>
    When I log in with username "<username>" and password "<password>"
    Then I see the error message "<error>"
    And I am still on the login page

    @TC-LOGIN-02
    Examples: Incorrect password
      | id          | case                               | username | password          | error                     |
      | TC-LOGIN-02 | valid username, incorrect password | student  | incorrectPassword | Your password is invalid! |

    @TC-LOGIN-03
    Examples: Both fields blank
      | id          | case              | username | password | error                     |
      | TC-LOGIN-03 | both fields blank |          |          | Your username is invalid! |

    @TC-LOGIN-04
    Examples: Invalid username
      | id          | case                             | username      | password    | error                     |
      | TC-LOGIN-04 | invalid username, valid password | incorrectUser | Password123 | Your username is invalid! |

    @TC-LOGIN-05
    Examples: Blank password
      | id          | case                           | username | password | error                     |
      | TC-LOGIN-05 | valid username, blank password | student  |          | Your password is invalid! |

  @TC-LOGIN-06 @security
  Scenario: TC-LOGIN-06 Password field masks the typed value
    When I type "Password123" into the password field
    Then the password field is masked
    And the password field holds the value "Password123"

  @TC-LOGIN-07 @positive
  Scenario: TC-LOGIN-07 Log out returns to the login page
    Given I have logged in with username "student" and password "Password123"
    When I log out
    Then I am back on the login page with the login form shown

  @TC-LOGIN-08 @recovery
  Scenario: TC-LOGIN-08 Valid login succeeds after a failed attempt
    Given I have failed to log in with username "student" and password "incorrectPassword"
    When I log in with username "student" and password "Password123"
    Then I am logged in as "student"
