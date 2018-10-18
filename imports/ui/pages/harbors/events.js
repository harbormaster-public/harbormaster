import { Template } from 'meteor/templating';

Template.harbors.events({
  'submit form' (e) {
    e.preventDefault();
    const repo_url = e.target.querySelector('input').value;
    H.call('Harbors#add', repo_url, (res) => {
      debugger;
    });
  },
});
