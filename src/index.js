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

import './css/default.css'
import NumberStepper from './stepper.js'
import rk4 from 'ode-rk4'

(function (window) {
    'use strict'
    const Default = {
        country: 'Germany',
        predict: 7,
    }
    const el = {}
    let refresh_interval_mins = 60
    let locale = 'de-DE'
    let main_chart = null
    let diff_chart = null
    let sir_chart = null
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

    const updateUI = data => {
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
        document.getElementById('current-doubling').innerText = `${confirmed.doubling_rates[confirmed.doubling_rates.length-1]} days`
        document.getElementById('App').classList.remove('hidden')
        el.loader_screen.classList.add('hide')
        calculateSIR()
        updateCharts()
    }

    const updateCharts = () => {
        let dates = [...confirmed.dates]
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        for (let day = 1; day <= hash_param.predict; ++day) {
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + day)
            dates.push(date)
        }
        dates = dates.map(d => d.toLocaleDateString(locale))
        el.current_date.innerText = dates[confirmed.dates.length - 1]
        el.latest_date.innerText = (hash_param.predict > 0 && confirmed.predicted)
            ? dates[confirmed.dates.length - 1 + hash_param.predict]
            : '–'
        el.current_cases.innerText = confirmed.active
            ? confirmed.active[confirmed.active.length - 1].toLocaleString(locale)
            : '–'
        el.latest_cases.innerText = (hash_param.predict > 0 && confirmed.predicted)
            ? confirmed.sir.I[confirmed.active.length + hash_param.predict - 1].toLocaleString(locale)
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
                        text: '∆ infected',
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
            main_chart.data.datasets[3].data = confirmed.sir.I
            main_chart.data.datasets[4].data = confirmed.sir.R
            main_chart.data.datasets[5].data = confirmed.doubling_rates
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
                            label: 'Infections',
                            backgroundColor: '#E65824',
                            borderWidth: 0,
                            order: 2,
                        },
                        {
                            data: confirmed.recovered,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Recoveries',
                            backgroundColor: '#7CDC58',
                            borderWidth: 0,
                            order: 2,
                        },
                        {
                            data: confirmed.deaths,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Deaths',
                            backgroundColor: '#D16EDC',
                            borderWidth: 0,
                            order: 3,
                        },
                        {
                            data: confirmed.sir.I,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Predicted infections',
                            backgroundColor: '#993B18',
                            borderWidth: 0,
                        },
                        {
                            data: confirmed.sir.R,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Predicted recoveries',
                            backgroundColor: '#4F8C38',
                            borderWidth: 0,
                        },
                        {
                            data: confirmed.doubling_rates,
                            type: 'line',
                            yAxisID: 'B',
                            label: 'Days per doubling',
                            pointStyle: 'circle',
                            backgroundColor: '#5BA5E6',
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

    const simulateSIR = (f, t0, y0, step, tmax) => {
        let integrator = rk4(y0, f, t0, step)
        let y = y0
        let ta = []
        let ya = []
        ta.push(t0)
        ya.push([...y])
        for (let t = t0; t < tmax; t += step) {
            integrator = integrator.step()
            ya.push([...integrator.y])
            ta.push(t)
        }
        return { t: ta, y: ya }
    }

    const calculateSIR = () => {
        const N = confirmed.active.length
        const I0 = confirmed.active[N-1]
        const R0 = confirmed.recovered[N-1]
        const S0 = confirmed.population - I0 - R0
        const Sstart = S0 / confirmed.population
        const Istart = I0 / confirmed.population
        const Rstart = R0 / confirmed.population
        const predicted = confirmed.predicted.SIR
        const maxT = Math.min(el.prediction_days.value, el.prediction_days.max)
        const step = 1

        function SIR_model(dydt, y, _t) {
            dydt[0] = -this.b * y[0] * y[1]
            dydt[1] = this.b * y[0] * y[1] - this.g * y[1]
            dydt[2] = this.g * y[1]
        }

        const solution_S = simulateSIR(SIR_model.bind({b: predicted.S.beta, g: predicted.S.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const solution_I = simulateSIR(SIR_model.bind({b: predicted.I.beta, g: predicted.I.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const solution_R = simulateSIR(SIR_model.bind({b: predicted.R.beta, g: predicted.R.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const total = solution_I.y.map((a, i) => a[1] + solution_R.y[i][2]).map(x => Math.round(x * confirmed.population))
        confirmed.sir = {
            t: solution_S.t,
            S: new Array(N).fill(null).concat(solution_S.y.slice(1).map(x => Math.round(x[0] * confirmed.population))),
            I: new Array(N).fill(null).concat(solution_I.y.slice(1).map(x => Math.round(x[1] * confirmed.population))),
            R: new Array(N).fill(null).concat(solution_R.y.slice(1).map(x => Math.round(x[2] * confirmed.population))),
            total: total,
        }
    }

    const evaluateHash = () => {
        let data = {}
        for (const param of window.location.hash.substring(1).split(';')) {
            const [key, value] = param.split('=')
            if (key && value) {
                data[key] = decodeURIComponent(value)
            }
        }
        data = Object.assign({}, Default, data)
        const days = Math.min(Math.max(0, +data.predict), +el.prediction_days.max)
        if (countries.indexOf(data.country) >= 0) {
            el.country_selector.value = data.country
            if (data.country !== hash_param.country) {
                hash_param.country = data.country
                loadCountryData()
            }
        }
        if (days !== hash_param.predict) {
            hash_param.predict = days
            el.prediction_days.value = days
            if (confirmed.active) {
                updateUI()
            }
        }
        updateHash(data)
    }

    const hashChanged = evt => {
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
                el.flag.innerText = data.flag
                el.population.innerText = data.population.toLocaleString(locale)
                evaluateHash()
                updateUI(data);
                animateRefreshables()
            },
            status => {
                showError(`Fetching data for »${hash_param.country}« failed: ${status}. Reload page to retry …`)
            })
    }

    const fetchCountryList = async () => {
        hideError()
        const response = await fetch('data/countries.json')
        const new_countries = await (response.ok
            ? response.json()
            : Promise.reject(response.status))
        countries = new_countries
        const datalist = document.getElementById('countries')
        countries.sort().forEach((country, index) => {
            const option = document.createElement('option')
            option.value = country
            datalist.appendChild(option)
        })
    }

    const countryChanged = evt => {
        confirmed = {}
        last_update = new Date(1970)
        updateHash({ country: evt.target.value })
    }

    const predictionDaysChanged = () => {
        updateHash({ predict: Math.min(+el.prediction_days.value, +el.prediction_days.max) })
    }

    const postInit = () => {
        el.country_selector.addEventListener('change', countryChanged)
        el.prediction_days.addEventListener('change', predictionDaysChanged)
        window.addEventListener('hashchange', hashChanged)
        document.getElementById('refresh-button').addEventListener('click', loadCountryData)
        setInterval(loadCountryData, 1000 * 60 * refresh_interval_mins)
    }

    const showError = msg => {
        el.error_message.innerText = msg
        el.error_message.classList.add('show')
    }

    const hideError = () => {
        el.error_message.innerText = ''
        el.error_message.classList.remove('show')
    }

    const main = () => {
        console.log('%c COVID-19 spread %c - current data and prediction.\nCopyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>', 'background: #222; color: #bada55; font-weight: bold;', 'background: transparent; color: #222; font-weight: normal;')
        customElements.define('number-stepper', NumberStepper)
        el.country_selector = document.getElementById('country-selector')
        el.flag = document.getElementById('flag')
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
