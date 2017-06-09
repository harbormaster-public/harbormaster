FROM node:4.6
MAINTAINER Skyler Brungardt <skyler@trueandco.com>

ADD . /opt/harbormaster

WORKDIR /opt/harbormaster

RUN curl https://install.meteor.com/ | sh
RUN mkdir /harbormaster
RUN meteor --allow-superuser build /harbormaster --directory
RUN cd /harbormaster/bundle/programs/server; npm install

ADD start.sh /start.sh

EXPOSE 80

VOLUME /root/.ssh

ENTRYPOINT ["/start.sh"]

