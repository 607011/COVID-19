# Covid-19

_Visualization of spread and predicted total Covid-19 cases_

![Covid-19 web app](webapp-preview.png)

## Prerequisites



## Installation

The [code](https://github.com/ola-ct/COVID-19) for this web app is hosted on GitHub. To clone the repository and its submodules enter the following on a command-line:

```
git clone https://github.com/ola-ct/COVID-19.git
git submodule init
git submodule update --remote
```

## Deployment

The latest Covid-19 spread data is fetched from Johns Hopkins' Center for Systems Science and Engineering ([CSSE](https://coronavirus.jhu.edu/map.html)) [repository](https://github.com/CSSEGISandData/COVID-19). Type 

```
gitmodule update --remote
```

to update the data residing in the two Git submodules.

Before deploying this app to a web server, some JSON files have to be generated from this data using bin/update-data.py. This script has some dependencies which you can resolve by executing

```
pipenv install
```

To launch the script, enter the [pipenv](https://pipenv-fork.readthedocs.io/en/latest/) shell:

```
pipenv shell
```

In that shell type

```
bin/update-data.py
```

to run the script. This will generate the aforementioned JSON files containing the latest spread date for each country.

Now the data is prepared you can deploy the app to a webserver. 

This app uses [webpack](https://webpack.js.org/) to bundle the files from src/ into the deployment directory dist/.

If you haven't done it already, install the necessary Node modules: 

```
npm install --save-dev
```

After that you can bundle the files by running

```
npx webpack
```

or, alternatively

```
npm run build
```

Now you can copy the files in dist/ to the web server of your choice. bin/deploy.sh contains a template for a script that copies the files via SSH to a remote directory. Feel free to modify it according to your enviroment.


## License

Copyright &copy; 2020 [Oliver Lau](mailto:ola@ct.de), [Heise Medien GmbH & Co. KG](http://www.heise.de/).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see [http://www.gnu.org/licenses/](http://www.gnu.org/licenses/).

---

Dieses Programm ist freie Software. Sie können es unter den Bedingungen der [GNU General Public License](http://www.gnu.org/licenses/gpl-3.0), wie von der Free Software Foundation veröffentlicht, weitergeben und/oder modifizieren, entweder gemäß Version 3 der Lizenz oder (nach Ihrer Wahl) jeder späteren Version.

__Diese Software wurde zu Lehr- und Demonstrationszwecken programmiert und ist nicht für den produktiven Einsatz vorgesehen. Der Autor und die Heise Medien GmbH & Co. KG haften nicht für eventuelle Schäden, die aus der Nutzung der Software entstehen, und übernehmen keine Gewähr für ihre Vollständigkeit, Fehlerfreiheit und Eignung für einen bestimmten Zweck.__

---

