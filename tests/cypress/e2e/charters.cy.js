import faker from 'faker';

describe('Charters', () => {
  const test_email = faker.internet.email();
  const test_password = faker.internet.password();

  beforeEach(() => {
    cy.resetDb();
    cy.visitAndWaitForSubscriptions('/');
    cy.ensureHarbormasterUser(test_email, test_password);
    cy.reload();
    cy.loginUi(test_email, test_password);
  });

  it('allow viewing a Charter', () => {
    cy.visit(`/lanes/${faker.lorem.word()}/charter`, {
      failOnStatusCode: false,
    });
    cy.get('#charter-page').should('be.visible');
  });
});


