/*
    COVID-19 spread visualization and prediction.
    Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>

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
import './css/tiny.css'
import NumberStepper from './stepper.js'
import rk4 from 'ode-rk4'

(function (window) {
    'use strict'
    const Default = {
        country: localStorage.getItem('country') || 'Germany',
        predict: +localStorage.getItem('prediction_days') || 0,
    }
    const EqIndicator = '<svg width="12" height="12" viewBox="0 0 12 12"><use aria-label="equal" xlink:href="#equal-indicator" fill="#FF6633"></use></svg>'
    const UpPosIndicator = '<svg width="12" height="12" viewBox="0 0 12 12"><use aria-label="up, good" xlink:href="#up-indicator" fill="#63D427"></use></svg>'
    const DwNegIndicator = '<svg width="12" height="12" viewBox="0 0 12 12"><use aria-label="down, bad" xlink:href="#down-indicator" fill="#D42C27"></use></svg>'
    const UpNegIndicator = '<svg width="12" height="12" viewBox="0 0 12 12"><use aria-label="up, bad" xlink:href="#up-indicator" fill="#D42C27"></use></svg>'
    const DwPosIndicator = '<svg width="12" height="12" viewBox="0 0 12 12"><use aria-label="down, good" xlink:href="#down-indicator" fill="#63D427"></use></svg>'
    let el = {}
    let refresh_interval_mins = 60
    let locale = 'de-DE'
    let main_chart = null
    let diff_chart = null
    let selected_country = null
    let countries = []
    let hash_param = {
        country: null,
        predict: null,
    }
    let confirmed = {}
    let last_update = new Date(1970)

    customElements.define('number-stepper', NumberStepper)

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

    const almostEqual = (a, b, eps = 0.1) => Math.abs(a - b) < eps

    const updateIfChanged = (el, newValue) => {
        if (el.innerHTML !== newValue) {
            el.innerHTML = newValue
        }
    }

    const updateUI = data => {
        if (data) {
            confirmed = Object.assign({}, data)
            confirmed.dates = data.dates.map(date => fromISODate(date))
        }
        last_update = fromISODate(confirmed.latest.last_update)
        updateIfChanged(el.latest_date, `${last_update.toLocaleDateString(locale)} ${last_update.toLocaleTimeString(locale)}`)
        updateIfChanged(el.latest_total, confirmed.latest.total.toLocaleString(locale))
        updateIfChanged(el.latest_active, confirmed.latest.active.toLocaleString(locale))
        updateIfChanged(el.latest_deaths, confirmed.latest.deaths.toLocaleString(locale))
        updateIfChanged(el.latest_recovered, confirmed.latest.recovered.toLocaleString(locale))
        const dbl = confirmed.doubling_rates[confirmed.doubling_rates.length-1]
        const dbl1 = confirmed.doubling_rates[confirmed.doubling_rates.length-2]
        const indicator = almostEqual(dbl, dbl1) ? EqIndicator : dbl > dbl1 ? UpPosIndicator : DwNegIndicator
        updateIfChanged(el.current_doubling, dbl > 0 ? `${dbl.toFixed(1)} days ${indicator}` : 'n/a')
        document.getElementById('App').classList.remove('hidden')
        el.loader_screen.classList.add('hide')
        calculateSIR()
        updateCharts()
    }

    const updateCharts = () => {
        let dates = [...confirmed.dates]
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        if (confirmed.predicted) {
            for (let day = 1; day <= hash_param.predict; ++day) {
                const date = new Date(curr_date)
                date.setDate(curr_date.getDate() + day)
                dates.push(date)
            }    
        }
        dates = dates.map(d => d.toLocaleDateString(locale))
        let indicator 
        updateIfChanged(el.current_date, dates[confirmed.dates.length - 1])
        updateIfChanged(el.predicted_date, (hash_param.predict > 0 && confirmed.predicted)
            ? dates[confirmed.dates.length - 1 + hash_param.predict]
            : '–')
        indicator = confirmed.active[confirmed.active.length - 1] > confirmed.active[confirmed.active.length - 2] ? UpNegIndicator : DwPosIndicator
        updateIfChanged(el.current_cases, confirmed.active
            ? `${confirmed.active[confirmed.active.length - 1].toLocaleString(locale)} ${indicator}` 
            : '–')
        if (confirmed.predicted) {
            indicator = confirmed.sir.I[confirmed.active.length + hash_param.predict - 1] > confirmed.sir.I[confirmed.active.length + hash_param.predict - 2] ? UpNegIndicator : DwPosIndicator
            updateIfChanged(el.predicted_cases, (hash_param.predict > 0 && confirmed.predicted)
                ? `${confirmed.sir.I[confirmed.active.length + hash_param.predict - 1].toLocaleString(locale)} ${indicator}`
                : '–')
        }
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
                        text: '∆ Infections',
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
            main_chart.data.datasets[3].data = confirmed.doubling_rates
            main_chart.data.datasets[4].data = confirmed.predicted ? confirmed.sir.I : null
            main_chart.data.datasets[5].data = confirmed.predicted ? confirmed.sir.R : null
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
                            data: confirmed.doubling_rates,
                            type: 'line',
                            yAxisID: 'B',
                            label: 'Days per doubling',
                            pointStyle: 'circle',
                            backgroundColor: '#5BA5E6',
                            showLine: false,
                            order: 0,
                        },
                        {
                            data: confirmed.predicted ? confirmed.sir.I : null,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Predicted infections',
                            backgroundColor: '#993B18',
                            borderWidth: 0,
                        },
                        {
                            data: confirmed.predicted ? confirmed.sir.R : null,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Predicted recoveries',
                            backgroundColor: '#4F8C38',
                            borderWidth: 0,
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

    function SIR_model(dydt, y, _t) {
        dydt[0] = -this.b * y[0] * y[1]
        dydt[1] = this.b * y[0] * y[1] - this.g * y[1]
        dydt[2] = this.g * y[1]
    }

    const calculateSIR = () => {
        const pred = confirmed.predicted ? confirmed.predicted.SIR : null
        if (pred === null)
            return
        const N = confirmed.active.length
        const population = confirmed.population
        const I0 = confirmed.active[N - 1]
        const R0 = confirmed.recovered[N - 1]
        const S0 = population - I0 - R0
        const Sstart = S0 / population
        const Istart = I0 / population
        const Rstart = R0 / population
        const maxT = Math.min(el.prediction_days.value, el.prediction_days.max)
        const step = 1

        const solution_S = simulateSIR(SIR_model.bind({b: pred.S.beta, g: pred.S.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const solution_I = simulateSIR(SIR_model.bind({b: pred.I.beta, g: pred.I.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const solution_R = simulateSIR(SIR_model.bind({b: pred.R.beta, g: pred.R.gamma}), 0, [Sstart - Istart, Istart, Rstart], step, maxT)
        const total = solution_I.y.map((a, i) => a[1] + solution_R.y[i][2]).map(x => Math.round(x * population))
        confirmed.sir = {
            t: solution_S.t,
            S: new Array(N).fill(null).concat(solution_S.y.slice(1).map(x => Math.round(x[0] * population))),
            I: new Array(N).fill(null).concat(solution_I.y.slice(1).map(x => Math.round(x[1] * population))),
            R: new Array(N).fill(null).concat(solution_R.y.slice(1).map(x => Math.round(x[2] * population))),
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
        if (Object.keys(countries).indexOf(data.country) >= 0) {
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
                updateIfChanged(el.population, data.population.toLocaleString(locale))
                updateUI(data)
                activateCountry(data.country)
            },
            status => {
                showError(`Fetching data for »${hash_param.country}« failed: ${status}. Reload page to retry …`)
            })
    }

    const activateCountry = country => {
        el.prediction_container.style.visibility = confirmed.predicted ? 'visible' : 'hidden'
        selected_country = country;
        [...document.querySelectorAll('.country.selected')].forEach(el => el.classList.remove('selected'))
        document.getElementById(`_${country}`).classList.add('selected')
        setTimeout(() => { // TODO: replace this dirty hack by a MutationObserver based solution
            document.getElementById(`_${country}`).scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            })
        }, 100)
    }

    const fetchCountryList = async () => {
        hideError()
        const response = await fetch('data/countries.json')
        const new_countries = await (response.ok
            ? response.json()
            : Promise.reject(response.status))
        countries = new_countries
        const root = document.getElementById('country-selector')
        const div = document.createElement('div')
        Object.keys(countries).sort().forEach((country, _index) => {
            const flag = document.createElement('span')
            flag.innerText = countries[country].flag
            div.appendChild(flag)
            const name = document.createElement('span')
            name.innerText = country
            name.id = `_${country}`
            name.className = 'country'
            name.addEventListener('click', () => { countryChanged(country) })
            div.appendChild(name)
        })
        root.appendChild(div)
    }

    const countryChanged = country => {
        confirmed = {}
        last_update = new Date(1970)
        localStorage.setItem('country', country)
        updateHash({ country: country })
    }

    const predictionDaysChanged = () => {
        localStorage.setItem('prediction_days', el.prediction_days.value)
        updateHash({ predict: Math.min(+el.prediction_days.value, +el.prediction_days.max) })
    }

    const postInit = () => {
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
        console.log('%c COVID-19 spread %c - current data and prediction.\nCopyright © 2020 Oliver Lau <oliver@ersatzworld.net>', 'background: #222; color: #bada55; font-weight: bold;', 'background: transparent; color: #222; font-weight: normal;')
        el = {
            country_selector: document.getElementById('country-selector'),
            prediction_container: document.getElementById('prediction-container'),
            loader_screen: document.getElementById('loader-screen'),
            current_date: document.getElementById('current-date'),
            current_cases: document.getElementById('current-cases'),
            current_doubling: document.getElementById('current-doubling'),
            predicted_date: document.getElementById('predicted-date'),
            predicted_cases: document.getElementById('predicted-cases'),
            prediction_days: document.getElementById('prediction-days'),
            population: document.getElementById('population'),
            error_message: document.getElementById('error-message'),
            latest_date: document.getElementById('latest-date'),
            latest_total: document.getElementById('latest-total'),
            latest_active: document.getElementById('latest-active'),
            latest_deaths: document.getElementById('latest-deaths'),
            latest_recovered: document.getElementById('latest-recovered'),
            refreshables: [...document.getElementsByClassName('refreshable')],
        }
        el.refreshables.forEach(element => {
            const observer = new MutationObserver((mutationsList, _observer) => {
                for (let mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                        mutation.target.classList.add('flash')
                        setTimeout(() => {
                            mutation.target.classList.remove('flash')
                        }, 1000)
                    }
                }
            })
            observer.observe(element, { childList: true, characterData: false, attributes: false, subtree: false })
        })
        console.debug(`w × h = ${window.innerWidth} x ${window.innerHeight}`)
        Chart.defaults.global.defaultFontFamily = 'Inria Sans, sans-serif'
        Chart.defaults.global.defaultFontSize = 13
        Chart.defaults.global.defaultFontColor = '#888'
        fetchCountryList()
            .then(
                () => {
                    postInit()
                    evaluateHash()
                },
                status => {
                    showError(`Loading country list failed: ${status}. Reload page to retry …`)
                })
    }
    window.addEventListener('load', main)
})(window)
