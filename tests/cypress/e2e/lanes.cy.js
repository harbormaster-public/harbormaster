import faker from 'faker';

describe('Lanes', () => {
  const test_email = faker.internet.email();
  const test_password = faker.internet.password();
  const lanes_route = 'lanes';

  beforeEach(() => {
    cy.resetDb();
    cy.visitAndWaitForSubscriptions('/');
    cy.ensureHarbormasterUser(test_email, test_password);
    cy.reload();
    cy.loginUi(test_email, test_password);
    cy.visitAndWaitForSubscriptions('/');
  });

  it('allow viewing the Lanes Page', () => {
    cy.get(`.nav-item[href="/${lanes_route}"]`).should('be.visible').click();
    cy.url().should('eq', `${Cypress.config('baseUrl')}/${lanes_route}`);
    cy.get('#lanes-page').should('be.visible');
  });

  it('allow creating a new Lane', () => {
    cy.get(`.nav-item[href="/${lanes_route}"]`).should('be.visible').click();
    cy.get('#new-lane').should('be.visible').click();
    cy.url().should('eq', `${Cypress.config('baseUrl')}/lanes/new/edit`);
    cy.get('#edit-lane-page').should('be.visible');
  });

  it('allow users to edit Lanes using \"new\" or a given path', () => {
    const given = faker.lorem.word();
    cy.visit(`/lanes/new/edit`, { failOnStatusCode: false });
    cy.url().should('eq', `${Cypress.config('baseUrl')}/lanes/new/edit`);
    cy.get('#edit-lane-page').should('be.visible');

    cy.visit(`/lanes/${given}/edit`, { failOnStatusCode: false });
    cy.url().should('eq', `${Cypress.config('baseUrl')}/lanes/${given}/edit`);
    cy.get('#edit-lane-page').should('be.visible');
  });

  it('allow shipping to a Lane', () => {
    cy.visit(`/lanes/${faker.lorem.word()}/ship`, { failOnStatusCode: false });
    cy.get('#ship-lane-page').should('be.visible');
  });

  it('allow viewing of historical shipments for a Lane', () => {
    const date = new Date();
    const date_string =
      `${date.getMonth()}-${date.getDate()}-${date.getHours()}-` +
      `${date.getMinutes()}-${date.getSeconds()}`;
    cy.visit(
      `/lanes/${faker.lorem.word()}/ship/${date_string}`,
      {
        failOnStatusCode: false,
      }
    );
    cy.get('#ship-lane-page').should('be.visible');
  });
});


