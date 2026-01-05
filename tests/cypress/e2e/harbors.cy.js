import faker from 'faker';

describe('Harbors', () => {
  const test_email = faker.internet.email();
  const test_password = faker.internet.password();

  beforeEach(() => {
    cy.resetDb();
    cy.visitAndWaitForSubscriptions('/');
    cy.ensureHarbormasterUser(test_email, test_password);
    cy.reload();
    cy.loginUi(test_email, test_password);
  });

  it('allow viewing a Harbor', () => {
    cy.visitAndWaitForSubscriptions('/harbors');
    cy.get('#harbors-page').should('be.visible');
  });
});


