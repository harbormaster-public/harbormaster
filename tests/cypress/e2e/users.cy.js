import faker from 'faker';

describe('Users', () => {
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

  it('allow viewing the Users Page showing all users', () => {
    cy.visitAndWaitForSubscriptions('/users');
    cy.get('#users-page').should('be.visible');
    cy.get('.users-table tbody tr').should('have.length.at.least', 1);
  });

  it('allow inviting a new User', () => {
    const new_user = faker.internet.email();

    cy.visitAndWaitForSubscriptions('/users');
    cy.get('.invite-user').should('be.visible').click();

    cy.url().should('eq', `${Cypress.config('baseUrl')}/users/add-user`);
    cy.get('#add-user-page').should('be.visible');

    cy.get('.email-user-invite').should('be.visible').type(new_user);
    cy.get('.send-invitation').should('be.visible').click();

    cy.url().should('eq', `${Cypress.config('baseUrl')}/users`);
    cy.get('#users-page').should('be.visible');
  });
});


