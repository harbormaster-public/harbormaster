import faker from 'faker';

describe('Routes', () => {
  const test_email = faker.internet.email();
  const test_password = faker.internet.password();

  beforeEach(() => {
    cy.resetDb();
  });

  describe('when there are no users', () => {
    beforeEach(() => {
      cy.visitAndWaitForSubscriptions('/');
      cy.get('h1', { timeout: 20000 }).should('be.visible');
    });

    it('show the Welcome Page', () => {
      cy.get('#new-instance').should('be.visible');
    });

    it('allow a new user to sign up', () => {
      cy.get('.email-user-invite').should('be.visible').type(test_email);
      cy.get('.password-user-invite')
        .should('be.visible')
        .type(test_password, { log: false });
      cy.get('.initial-sign-in').should('be.visible').click();

      cy.get('.acknowledge-new-harbormaster', { timeout: 15000 })
        .should('be.visible')
        .click();
      cy.get('#navigation', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('when there are users', () => {
    beforeEach(() => {
      cy.visitAndWaitForSubscriptions('/');
      cy.ensureHarbormasterUser(test_email, test_password);
      cy.reload();
    });

    it('allow users to login and logout', () => {
      cy.loginUi(test_email, test_password);

      cy.window({ log: false }).then((win) => {
        return new Cypress.Promise((resolve) => {
          win.Meteor.logout(() => resolve());
        });
      });

      cy.get('#navigation').should('not.exist');
      cy.get('.login-form', { timeout: 60000 }).should('be.visible');
    });

    it('allow a user to reset a password', () => {
      cy.get('.login-form', { timeout: 60000 }).should('be.visible');
      cy.get('.login-form input[type="email"]').clear().type(test_email);
      cy.get('.forgot-password').should('be.visible').click();
      cy.get('.instructions').should('be.visible');
    });
  });

  describe('for logged in users', () => {
    beforeEach(() => {
      cy.visitAndWaitForSubscriptions('/');
      cy.ensureHarbormasterUser(test_email, test_password);
      cy.reload();
      cy.loginUi(test_email, test_password);
      cy.get('#last-time-shipped-header', { timeout: 60000 })
        .should('be.visible');
    });

    it('redirect missing Lane names to the Lanes Page', () => {
      cy.visit('/lanes//ship', { failOnStatusCode: false });
      cy.url().should('eq', `${Cypress.config('baseUrl')}/lanes`);
    });
  });
});


