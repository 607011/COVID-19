/*
    COVID-19 spread visualization and active cases prediction.
    Copyright (c) 2020 Oliver Lau <oliver.lau@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

(function (window) {
    'use strict'

    const Default = {
        country: 'Germany',
        predict: 7,
    }
    const el = {}
    let locale = 'de-DE'
    let main_chart = null
    let diff_chart = null
    let countries = []
    let hash_param = {
        country: null,
        predict: null,
    }
    let confirmed = {}
    let last_update = new Date(1970)

    const fromISODate = iso_date_string => {
        const [, year, month, day, ...time] = iso_date_string.match(/^(\d{4})-(\d{2})-(\d{2})(\s(\d{2}):(\d{2}):(\d{2}))?/)
        const date = new Date(year, month-1, day, 0, 0, 0, 0)
        const [, hrs, mins, secs] = time
        if (hrs && mins && secs) {
            date.setHours(hrs)
            date.setMinutes(mins)
            date.setSeconds(secs)
        }
        return date
    }

    const updateCharts = data => {
        if (data) {
            confirmed = Object.assign({}, data)
            confirmed.dates = data.dates.map(date => fromISODate(date))
        }
        last_update = fromISODate(confirmed.latest.last_update)
        document.getElementById('latest-date').innerText = `${last_update.toLocaleDateString(locale)} ${last_update.toLocaleTimeString(locale)}`
        document.getElementById('latest-total').innerText = confirmed.latest.total.toLocaleString(locale)
        document.getElementById('latest-active').innerText = confirmed.latest.active.toLocaleString(locale)
        document.getElementById('latest-deaths').innerText = confirmed.latest.deaths.toLocaleString(locale)
        document.getElementById('latest-recovered').innerText = confirmed.latest.recovered.toLocaleString(locale)
        document.getElementById('App').classList.remove('hidden')
        el.loader_screen.classList.add('hide')
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        let dates = [...confirmed.dates]
        for (let day = 0; day < hash_param.predict; ++day) {
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + day + 1)
            dates.push(date)
        }
        const predicted = confirmed.predicted
            ? new Array(confirmed.active.length).fill(null).concat(confirmed.predicted.active.slice(0, hash_param.predict))
            : []
        dates = dates.map(d => d.toLocaleDateString(locale))
        el.current_date.innerText = dates[confirmed.dates.length - 1]
        el.latest_date.innerText = (hash_param.predict > 0 && confirmed.predicted)
            ? dates[confirmed.dates.length - 1 + hash_param.predict]
            : '–'
        el.current_cases.innerText = confirmed.active
            ? confirmed.active[confirmed.active.length - 1].toLocaleString(locale)
            : '–'
        el.latest_cases.innerText = (hash_param.predict > 0 && confirmed.predicted)
            ? confirmed.predicted.active[hash_param.predict - 1].toLocaleString(locale)
            : '–'
        if (diff_chart) {
            diff_chart.data.labels = dates.slice(0, confirmed.total.length)
            diff_chart.data.datasets[0].data = confirmed.delta
            diff_chart.update()
        }
        else {
            diff_chart = new Chart(document.getElementById('diff-chart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dates.slice(0, confirmed.total.length),
                    datasets: [
                        {
                            data: confirmed.delta,
                            backgroundColor: (function(_opaque, ctx) {
                                return ctx.dataset.data[ctx.dataIndex] < 0 ? '#63D427' : '#D42C27'
                            }).bind(null, false),
                        }
                    ]
                },
                options: {
                    title: {
                        display: true,
                        text: '∆ active cases',
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: false,
                    },
                    scales: {
                        xAxes: [
                            {
                                gridLines: {
                                    display: false,
                                    drawTicks: false,
                                },
                                ticks: {
                                    display: false,
                                },
                            }
                        ],
                        yAxes: [
                            {
                                gridLines: {
                                    display: true,
                                    drawTicks: false,
                                },
                                ticks: {
                                    display: false,
                                },
                            },
                        ],    
                    },
                    animation: {
                        duration: 250,
                        easing: 'easeInOutQuad',
                    }
                }
            })
        }
        if (main_chart) {
            main_chart.data.labels = dates
            main_chart.data.datasets[0].data = confirmed.active
            main_chart.data.datasets[1].data = confirmed.recovered
            main_chart.data.datasets[2].data = confirmed.deaths
            main_chart.data.datasets[3].data = predicted
            main_chart.data.datasets[4].data = confirmed.doubling_rates
            main_chart.update()
        }
        else {
            main_chart = new Chart(document.getElementById('main-chart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            data: confirmed.active,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'active',
                            backgroundColor: 'rgb(230, 88, 36)',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.recovered,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'recovered',
                            backgroundColor: '#7CDC58',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.deaths,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'deaths',
                            backgroundColor: '#D16EDC',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 3,
                        },
                        {
                            data: predicted,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'predicted total',
                            backgroundColor: 'rgba(230, 88, 36, 0.5)',
                            borderWidth: 0,
                            fill: 'transparent',
                        },
                        {
                            data: confirmed.doubling_rates,
                            type: 'line',
                            yAxisID: 'B',
                            label: 'days per doubling',
                            borderColor: '#5BA5E6',
                            borderWidth: 2,
                            pointStyle: 'circle',
                            fill: 'transparent',
                            showLine: false,
                            order: 0,
                        },
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [
                            {
                                stacked: true,
                                gridLines: {
                                    display: false,
                                },
                            }
                        ],
                        yAxes: [
                            {
                                id: 'A',
                                type: 'linear',
                                position: 'right',
                                precision: 1,
                                stacked: true,
                                beginAtZero: true,
                            },
                            {
                                id: 'B',
                                type: 'linear',
                                position: 'left',
                                precision: 0.1,
                                stacked: false,
                                beginAtZero: true,
                                gridLines: {
                                    display: false,
                                },
                            },
                        ]
                    },
                    animation: {
                        duration: 500,
                        easing: 'easeInOutQuad',
                    }
                }
            })
        }
    }

    const evaluateHash = () => {
        console.debug('evaluateHash()')
        let data = {}
        for (const param of window.location.hash.substring(1).split(';')) {
            const [key, value] = param.split('=')
            if (key && value) {
                data[key] = decodeURIComponent(value)
            }
        }
        data = Object.assign({}, Default, data)
        console.debug('evaluateHash() data = ', data)
        console.debug('evaluateHash() hash_param = ', hash_param)
        const days = Math.min(Math.max(0, +data.predict), +el.prediction_days.getAttribute('max'))
        if (countries.indexOf(data.country) >= 0) {
            if (data.country !== hash_param.country) {
                hash_param.country = data.country
                loadCountryData()
            }
        }
        if (days !== data.predict && days != hash_param.predict) {
            hash_param.predict = days
            el.prediction_days.value = days
            if (confirmed.active) {
                updateCharts()
            }
        }
        updateHash(data)
    }

    const hashChanged = evt => {
        console.debug('hashChanged()', evt)
        if (evt && evt.oldURL !== evt.newURL) {
            evaluateHash()
        }
    }

    const updateHash = (obj = {}) => {
        const new_hash_param = Object.assign({}, hash_param, obj)
        window.location.hash = '#' + Object.keys(new_hash_param).map(key => `${key}=${new_hash_param[key]}`).join(';')
    }

    const animateRefreshables = () => {
        [...document.getElementsByClassName('refreshable')].forEach(el => el.classList.add('flash'))
        setTimeout(() => {
            [...document.getElementsByClassName('refreshable')].forEach(el => el.classList.remove('flash'))
        }, 1000)
    }

    const loadCountryData = () => {
        console.debug('loadCountryData()')
        el.loader_screen.classList.remove('hide')
        hideError()
        fetch(`data/${hash_param.country}.json`)
            .then(response => {
                return response.ok
                    ? response.json()
                    : Promise.reject(response.status)
            })
            .then(data => {
                [...document.getElementsByClassName('country')].forEach(el => el.innerText = data.country)
                el.prediction_days.setAttribute('max', data.predicted ? data.predicted.active.length : 0)
                // if (last_update.getTime() === fromISODate(data.latest.last_update).getTime()) {
                //     console.log('no updates')
                // }
                el.population.innerText = data.population.toLocaleString(locale)
                updateCharts(data);
                animateRefreshables()
            },
            status => {
                showError(`Fetching data for »${hash_param.country}« failed: ${status}. Reload page to retry …`)
            })
    }

    const fetchCountryList = async () => {
        hideError()
        console.debug('fetchCountryList()')
        const response = await fetch('data/countries.json')
        const new_countries = await (response.ok
            ? response.json()
            : Promise.reject(response.status))
        // TODO: convert <select>/<option> to <input type="search" ...>
        countries = new_countries
        el.country_selector.innerHTML = ''
        let selectedIndex = null
        countries.sort().forEach((country, index) => {
            const option = document.createElement('option')
            option.value = country
            option.innerText = country
            if (country === hash_param.country)
                selectedIndex = index
            el.country_selector.appendChild(option)
        })
        el.country_selector.selectedIndex = selectedIndex
    }

    const countryChanged = evt => {
        confirmed = {}
        last_update = new Date(1970)
        updateHash({ country: evt.target.options[evt.target.selectedIndex].label })
    }

    const predictionDaysChanged = evt => {
        const days = Math.min(+evt.target.value, +el.prediction_days.getAttribute('max'))
        updateHash({ predict: days })
    }

    const postInit = () => {
        el.country_selector.addEventListener('change', countryChanged)
        el.prediction_days.addEventListener('change', predictionDaysChanged);
        window.addEventListener('hashchange', hashChanged)
        document.getElementById('refresh-button').addEventListener('click', loadCountryData);
        // TODO: convert <input type="number"> to Custom Element
        [...document.getElementsByClassName('stepper')].forEach(stepper => {
            const input = stepper.querySelector('input')
            input.previousElementSibling.addEventListener('click', _ => { input.stepDown(); input.dispatchEvent(new Event('change')) })
            input.nextElementSibling.addEventListener('click', _ => { input.stepUp(); input.dispatchEvent(new Event('change')) })
        })
    }

    const showError = msg => {
        el.error_message.innerText = msg
        el.error_message.classList.add('show')
    }

    const hideError = msg => {
        el.error_message.innerText = ''
        el.error_message.classList.remove('show')
    }

    const main = () => {
        el.country_selector = document.getElementById('country-selector')
        el.loader_screen = document.getElementById('loader-screen')
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('predicted-date')
        el.latest_cases = document.getElementById('predicted-cases')
        el.prediction_days = document.getElementById('prediction-days')
        el.population = document.getElementById('population')
        el.error_message = document.getElementById('error-message')
        fetchCountryList()
            .then(
                () => {
                    evaluateHash()
                    postInit()
                },
                status => {
                    showError(`Loading country list failed: ${status}. Reload page to retry …`)
                })
    }
    window.addEventListener('load', main)
})(window)
