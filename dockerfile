FROM strictlyskyler/meteor-environment:latest
LABEL maintainer="Skyler Brungardt <skyler.brungardt@gmail.com>"

ADD . /opt/harbormaster

WORKDIR /opt/harbormaster

RUN mkdir /harbormaster
RUN meteor npm install
RUN meteor --allow-superuser build /harbormaster --directory
RUN ln -s /opt/harbormaster/start.sh /start.sh

WORKDIR /harbormaster/bundle/programs/server
RUN npm install
WORKDIR /

VOLUME /root/.ssh

ENTRYPOINT ["./start.sh"]