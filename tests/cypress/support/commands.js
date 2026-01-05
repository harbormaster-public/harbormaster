// Custom Cypress commands for Harbormaster.

// Query helpers
Cypress.Commands.add('getByTestId', (id, ...args) => {
  return cy.get(`[data-test-id="${id}"]`, ...args);
});

// Meteor helpers (inspired by
// https://blog.meteor.com/testing-a-meteor-app-with-cypress-bfb3d3c6ed6f)
Cypress.Commands.add('getMeteor', () => {
  return cy.window({ log: false }).its('Meteor', { log: false });
});

Cypress.Commands.add('allSubscriptionsReady', () => {
  return cy.window({ log: false }).then((win) => {
    return new Cypress.Promise((resolve) => {
      const check = () => {
        try {
          if (win?.Meteor?.status && win.Meteor.status().connected !== true) {
            setTimeout(check, 50);
            return;
          }
          // This global exists in Meteor client runtime
          if (win?.DDP?._allSubscriptionsReady?.()) {
            resolve(true);
            return;
          }
        }
        catch (e) {
          console.error(e, 'Error checking subscriptions');
          // ignore and retry
        }
        setTimeout(check, 50);
      };
      check();
    });
  });
});

Cypress.Commands.add('visitAndWaitForSubscriptions', (path, options = {}) => {
  return cy.visit(path, options).then(() => cy.allSubscriptionsReady());
});

Cypress.Commands.add('callMethod', (name, ...args) => {
  return cy.window({ log: false }).then((win) => {
    return new Cypress.Promise((resolve, reject) => {
      if (!win?.Meteor?.call) {
        reject(new Error('Meteor.call is not available on window'));
        return;
      }
      win.Meteor.call(name, ...args, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  });
});

// App-specific helpers
Cypress.Commands.add('resetDb', () => {
  return cy.task('db:reset', null, { log: false });
});

Cypress.Commands.add('ensureHarbormasterUser', (email, password) => {
  // Requires the app to be loaded at least once so Meteor.call exists.
  return cy
    .callMethod('Users#invite_user', email, password)
    .then(() =>
      cy.callMethod('Users#update', email, {
        harbormaster: true,
        emails: [{ address: email }],
      })
    );
});

Cypress.Commands.add('loginUi', (email, password) => {
  cy.get('.login-form', { timeout: 60000 }).should('be.visible');
  cy.get('.login-form input[type="email"]').clear().type(email);
  cy.get('.login-form input[type="password"]')
    .clear()
    .type(password, { log: false });
  cy.get('button.sign-in').click();

  // First-user flow sometimes shows a harbormaster acknowledgement.
  cy.get('body').then(($body) => {
    if ($body.find('.acknowledge-new-harbormaster').length) {
      cy.get('.acknowledge-new-harbormaster').click();
    }
  });

  return cy.get('#navigation', { timeout: 60000 }).should('be.visible');
});


