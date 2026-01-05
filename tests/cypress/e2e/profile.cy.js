import faker from 'faker';

describe('Profiles', () => {
  const test_email = faker.internet.email();
  const test_password = faker.internet.password();

  beforeEach(() => {
    cy.resetDb();
    cy.visitAndWaitForSubscriptions('/');
    cy.ensureHarbormasterUser(test_email, test_password);
    cy.reload();
    cy.loginUi(test_email, test_password);
    cy.get('#last-time-shipped-header', { timeout: 60000 })
      .should('be.visible');
  });

  it('allow viewing a User Profile', () => {
    cy.visitAndWaitForSubscriptions('/users');
    cy.get('.users-table tbody tr:first-child .profile', { timeout: 60000 })
      .should('be.visible')
      .click();
    cy.get('#profile-page').should('be.visible');
  });
});


