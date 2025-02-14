// Add this line at the top of your file, after Chart.js is imported
Chart.register(ChartDataLabels);

// Dashboard state management
const DashboardState = {
    charts: new Map(),
    filters: {},
    initialData: null
};

// Initialize the dashboard with data from Flask
async function initializeDashboard(initialData) {
    console.log('Initializing dashboard');
    showLoader();
    
    try {
        DashboardState.initialData = initialData;
        console.log('Initial data:', initialData);
        
        await initializeUIComponents();
        console.log('UI components initialized');
        
        await Promise.all([
            createCharts(initialData),
            createAdditionalCharts(initialData),
            createPredictedSalesChart(initialData.response)
        ]);
        console.log('All charts created');
        
    } catch (error) {
        console.error('Error during dashboard initialization:', error);
        alert('Error initializing dashboard: ' + error.message);
    } finally {
        hideLoader();
    }
}

// UI Components initialization
function initializeUIComponents() {
    // Initialize jQuery UI sliders
    $("#ageSlider").slider({
        range: true,
        min: 0,
        max: 100,
        values: [20, 60],
        slide: function(event, ui) {
            $("#ageRange").text(ui.values[0] + " - " + ui.values[1]);
        }
    });
    $("#ageRange").text("20 - 60");

    $("#ratingSlider").slider({
        range: true,
        min: 0,
        max: 5,
        step: 0.1,
        values: [1, 4.5],
        slide: function(event, ui) {
            $("#ratingRange").text(ui.values[0] + " - " + ui.values[1]);
        }
    });
    $("#ratingRange").text("1.0 - 4.5");

    // Initialize datepickers
    $("#startDateFilter").datepicker({
        onSelect: function(dateText) {
            $("#startDate").text(dateText);
        }
    });

    $("#endDateFilter").datepicker({
        onSelect: function(dateText) {
            $("#endDate").text(dateText);
        }
    });

    // Initialize store sales table sorting
    initializeStoreSalesTable();
}

// Chart Configuration
const ChartConfig = {
    colors: {
        bins: [
            '#03DAC6', '#018786', '#67E8C7', '#00B9B3',
            '#40E0D0', '#48D1CC', '#20B2AA', '#5F9EA0',
        ],
        base: {
            background: '#03DAC6',
            primary: '#018786',
            secondary: '#67E8C7',
            accent1: '#00B9B3',
            accent2: '#40E0D0',
            accent3: '#ff06ef',
            accent4:'#ff06ee2a',
            highlight: '#B2FFF9',
            neutral: '#5F9EA0',
            contrast: '#016D6B'
        }
    },
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 750,
            easing: 'easeInOutQuart'
        }
    },
    lineDefaults: {
        pointBackgroundColor: 'rgba(1, 135, 134, 0.5)',  // Semi-transparent version of #018786
        pointBorderColor: '#018786',  // Solid border
        pointHoverBackgroundColor: '#018786',  // Solid on hover
        pointHoverBorderColor: '#018786',
        pointRadius: 4,
        pointHoverRadius: 8
    },
    barDefaults: {
        backgroundColor: '#00B9B3', // Primary color
        borderColor: '#018786',
        hoverBackgroundColor: 'rgba(1, 135, 134, 0.8)', // Slightly transparent on hover
        hoverBorderColor: '#ff06ef', // Accent color on hover
        borderWidth: 1
    },
    pieDefaults: {
        datalabels: {
            color: '#fff',
            font: {
                weight: 'bold',
                size: 14
            },
            padding: 6,
            borderRadius: 4,
            listeners: {
                enter: function(context) {
                    context.element.options.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                    context.element.options.font.size = 16;
                    context.chart.draw();
                },
                leave: function(context) {
                    context.element.options.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    context.element.options.font.size = 14;
                    context.chart.draw();
                }
            }
        }
    },
    getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        return {
            textColor: isDark ? '#E0E0E0' : '#333333',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        };
    }
};

// Update getLegendConfig function
function getLegendConfig(display = true, position = 'right', data = null) {
    const { textColor } = ChartConfig.getThemeColors();
    return {
        display,
        position,
        labels: {
            color: textColor,
            font: {
                size: 12,
                color: textColor 
            },
            usePointStyle: true, 
            generateLabels: (chart) => {
                const dataset = chart.data.datasets[0];
                return chart.data.labels.map((label, index) => ({
                    text: label,
                    fillStyle: dataset.backgroundColor[index],
                    strokeStyle: dataset.borderColor[index],
                    lineWidth: 1,
                    hidden: false,
                    index: index,
                    color: textColor  // Force text color to be light
                }));
            }
        }
    };
}

// Add this utility function after the ChartConfig definition
function isValidData(data) {
    if (!data) return false;
    if (Array.isArray(data) && data.length === 0) return false;
    if (typeof data === 'object' && Object.keys(data).length === 0) return false;
    if (Object.values(data).every(value => !value)) return false;
    return true;
}

// Add this function to handle chart container visibility
function toggleChartVisibility(chartId, show) {
    const container = document.querySelector(`.chart-container:has(#${chartId})`);
    if (container) {
        container.style.display = show ? 'block' : 'none';
    }
}

// Enhanced Chart Creation Functions
function createCharts(data) {
    console.log('Creating charts with data:', data);
    
    // Handle both direct data and nested data structures
    const graphs = data.graphs || data;
    
    if (!graphs) {
        console.error('No valid graph data found');
        return;
    }

    // Validate each graph type before creation
    try {
        Object.entries({
            'categoryChart': ['sales_by_category', createCategoryChart],
            'seasonChart': ['sales_by_season', createSeasonChart],
            'locationChart': ['sales_by_location', createLocationChart],
            'salesTrendChart': ['sales_by_month', function(data) {
                // Store the monthly and yearly data in a global variable for period switching
                window.salesTrendsData = {
                    month: data,
                    year: graphs.sales_by_year || {}
                };
                createSalesTrendChart(window.salesTrendsData, 'month');
            }],
            'regionChart': ['sales_by_region', createRegionChart],
            'storeSizeChart': ['sales_by_store_size', createStoreSizeChart],
            'topSellingProductsChart': ['top_selling_products', createTopSellingProductsChart],
            'crossSellUpsellChart': ['cross_sell_upsell_opportunities', createCrossSellUpsellChart],
            'clvDistributionChart': ['clv_distribution', createCLVDistributionChart],
            'discountImpactChart': ['discount_impact', createDiscountImpactChart],
            'ageChart': ['age_distribution', createAgeDistributionChart],
            'genderChart': ['gender_distribution', createGenderDistributionChart],
            'ageBinsChart': ['sales_by_age_bins', createAgeBinsChart],
            'peakHoursChart': ['peak_purchase_hours', createPeakHoursChart],
            'promoCodeChart': ['promo_code_usage', createPromoCodeChart],
            'discountHistogramChart': ['discount_histogram', createDiscountHistogramChart],
            'rfmSegmentsChart': ['rfm_segments', createRFMSegmentsChart],
            'visitVsPurchaseFrequencyChart': ['visit_vs_purchase_frequency', createVisitVsPurchaseChart],
            'salesByDayChart': ['sales_by_day', createSalesByDayChart],
            
        }).forEach(([chartId, [dataKey, createFunction]]) => {
            if (graphs[dataKey]) {
                console.log(`Creating ${chartId}`);
                createFunction(graphs[dataKey]);
            } else {
                console.log(`No data for ${chartId}`);
                toggleChartVisibility(chartId, false);
            }
        });

        console.log('All charts created successfully');
    } catch (error) {
        console.error('Error creating charts:', error);
        throw error;
    }
}

// Update createOrUpdateChart function
function createOrUpdateChart(id, type, data, options = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) {
        console.warn(`Canvas element not found: ${id}`);
        return null;
    }

    // Check if the data is valid
    if (!isValidData(data.datasets[0].data)) {
        console.warn(`No valid data for chart: ${id}`);
        toggleChartVisibility(id, false);
        return null;
    }

    toggleChartVisibility(id, true);
    
    // Apply datalabels plugin for pie and doughnut charts
    const chartOptions = {
        ...ChartConfig.defaultOptions,
        ...options,
        plugins: {
            ...options.plugins,
            legend: {
                ...(options.plugins?.legend || getLegendConfig(false)),
                labels: {
                    color: '#E0E0E0',
                    font: { size: 12 },
                    usePointStyle: true
                }
            },
            datalabels: type === 'pie' || type === 'doughnut' ? {
                color: '#fff',
                font: { weight: 'bold', size: 14 },
                padding: 6,
                borderRadius: 4,
                formatter: (value, ctx) => {
                    const dataset = ctx.chart.data.datasets[0];
                    const total = dataset.data.reduce((sum, val) => sum + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${percentage}%`;
                },
                display: true // Force display for pie/doughnut charts
            } : false // Disable for other chart types
        }
    };

    // If chart exists, update it
    if (DashboardState.charts.has(id)) {
        const chart = DashboardState.charts.get(id);
        chart.data = data;
        chart.options = chartOptions;
        chart.update('none');
        return chart;
    }

    // Create new chart
    const chart = new Chart(canvas.getContext('2d'), {
        type,
        data,
        options: chartOptions
    });

    DashboardState.charts.set(id, chart);
    return chart;
}

// Individual Chart Creation Functions
function createCategoryChart(data) {
    if (!isValidData(data)) {
        toggleChartVisibility('categoryChart', false);
        return;
    }
    
    const sortedEntries = Object.entries(data).sort((a, b) => a[1] - b[1]);
    const chartData = {
        labels: sortedEntries.map(entry => entry[0]),
        datasets: [{
            label: 'Sales by Category',
            data: sortedEntries.map(entry => entry[1]),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('categoryChart', 'bar', chartData, {
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: {
            y: getDefaultScaleConfig(true)
        }
    });
}

function createSeasonChart(data) {
    if (!isValidData(data)) {
        toggleChartVisibility('seasonChart', false);
        return;
    }
    
    const sortedEntries = Object.entries(data)
        .sort(([, a], [, b]) => b - a);

    const chartData = {
        labels: sortedEntries.map(([label]) => label),
        datasets: [{
            label: 'Sales by Season',
            data: sortedEntries.map(([, value]) => value),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('seasonChart', 'bar', chartData, {
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: { 
            y: getDefaultScaleConfig(true)
        }
    });
}

function createLocationChart(data) {
    if (!isValidData(data)) {
        toggleChartVisibility('locationChart', false);
        return;
    }

    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            label: 'Sales by Location',
            data: Object.values(data),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('locationChart', 'bar', chartData, {
        indexAxis: 'y',
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: { 
            x: getDefaultScaleConfig(true)
        }
    });
}

function createSalesTrendChart(data, period = 'month') {
    if (!data) return;
    
    const chartData = {
        labels: Object.keys(data[period]),
        datasets: [{
            label: `Sales by ${period.charAt(0).toUpperCase() + period.slice(1)}`,
            data: Object.values(data[period]),
            borderColor: '#bd2ba0',
            backgroundColor: 'rgba(189, 43, 160, 0.1)',
            hoverBorderColor: ChartConfig.colors.base.accent3,
            fill: true,
            tension: 0.4,
            ...ChartConfig.lineDefaults
        }]
    };

    createOrUpdateChart('salesTrendChart', 'line', chartData, {
        plugins: { 
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: {
            y: getDefaultScaleConfig(true)
        }
    });
}

// Add event listener for period selector
document.getElementById('salesTrendPeriod').addEventListener('change', function(e) {
    const period = e.target.value;
    createSalesTrendChart(graphData, period);
    // Update tooltip text based on period
    document.getElementById('salesTrendTooltip').textContent = 
        period === 'month' ? 'Monthly sales trends, showing how sales fluctuate over the course of a year.' 
                          : 'Yearly sales trends, showing long-term sales performance.';
});

// Update createRegionChart function
function createRegionChart(data) {
    if (!data) return;

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ChartConfig.colors.bins,
            borderColor: ChartConfig.colors.bins.map(color => color),
            hoverBorderColor: ChartConfig.colors.base.accent3
        }]
    };

    createOrUpdateChart('regionChart', 'pie', chartData, {
        plugins: {
            legend: getLegendConfig(true, 'right', data),
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `${context.label}: ${formatCurrency(context.raw)}`;
                    }
                }
            }
        }
    });
}

function createStoreSizeChart(data) {
    if (!data) return;

    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            label: 'Sales by Store Size',
            data: Object.values(data),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('storeSizeChart', 'bar', chartData, {
        indexAxis: 'y',
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: { 
            x: getDefaultScaleConfig(true)
        }
    });
}

function createTopSellingProductsChart(data) {
    if (!data) return;

    const sortedEntries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const chartData = {
        labels: sortedEntries.map(entry => entry[0]),
        datasets: [{
            label: 'Top Selling Products',
            data: sortedEntries.map(entry => entry[1]),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('topSellingProductsChart', 'bar', chartData, {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    });
}

function createCrossSellUpsellChart(data) {
    if (!data) return;

    // Sort pairs by total in ascending order
    const pairs = Object.entries(data)
        .sort(([, a], [, b]) => a.total - b.total)
        .map(([pair]) => pair);

    const totals = pairs.map(pair => data[pair].total);

    const chartData = {
        labels: pairs,
        datasets: [{
            label: 'Cross-Sell & Upsell Amount',
            data: totals,
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('crossSellUpsellChart', 'bar', chartData, {
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${formatCurrency(context.raw, false)}`;
                    },
                    afterLabel: context => {
                        const pair = context.label;
                        const pairData = data[pair];
                        return Object.entries(pairData.contributions).map(
                            ([cat, amount]) => `${cat}: ${formatCurrency(amount, true)}`
                        );
                    }
                }
            }
        },
        scales: {
            x: {
                ...getDefaultScaleConfig(true),
                beginAtZero: true
            }
        }
    });
}

function createCLVDistributionChart(data) {
    if (!data) return;

    // Sort data in descending order
    const sortedEntries = Object.entries(data)
        .sort(([, a], [, b]) => b - a);

    const chartData = {
        labels: sortedEntries.map(([label]) => label),
        datasets: [{
            label: 'Customer Lifetime Value',
            data: sortedEntries.map(([, value]) => value),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('clvDistributionChart', 'bar', chartData, {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    });
}

// Add this helper function at the top with other helpers
function validateData(data, chartId) {
    if (!data || Object.keys(data).length === 0) {
        console.warn(`No data available for ${chartId}`);
        return { labels: [], values: [] };
    }
    return {
        labels: Object.keys(data),
        values: Object.values(data)
    };
}

// Replace the existing createDiscountImpactChart function
function createDiscountImpactChart(data) {
    if (!data) return;

    const discountImpactData = validateData(data, 'discountImpactChart');
    const discountLabels = discountImpactData.labels;
    const discountMean = discountLabels.map(label => data[label].mean);
    const discountSum = discountLabels.map(label => data[label].sum);
    const discountConversionRate = discountLabels.map(label => data[label].conversion_rate);

    const chartData = {
        labels: discountLabels,
        datasets: [
            {
                label: 'Mean Purchase Amount (USD)',
                data: discountMean,
                backgroundColor: ChartConfig.colors.bins[0],
                borderColor: ChartConfig.colors.bins[0],
                hoverBorderColor: ChartConfig.colors.base.accent3,
                borderWidth: 1,
                yAxisID: 'y1'
            },
            {
                label: 'Total Purchase Amount (USD)',
                data: discountSum,
                backgroundColor: ChartConfig.colors.bins[1],
                borderColor: ChartConfig.colors.bins[1],
                hoverBorderColor: ChartConfig.colors.base.accent3,
                borderWidth: 1,
                yAxisID: 'y1'
            },
            {
                label: 'Conversion Rate',
                data: discountConversionRate,
                backgroundColor:  ChartConfig.colors.base.accent3,
                borderColor: ChartConfig.colors.base.accent3,
                hoverBorderColor: ChartConfig.colors.base.accent3,
                borderWidth: 1,
                type: 'line',
                yAxisID: 'y2'
            }
        ]
    };

    createOrUpdateChart('discountImpactChart', 'bar', chartData, {
        scales: {
            y1: {
                ...getDefaultScaleConfig(true),
                type: 'linear',
                position: 'left',
                title: {
                    display: true,
                    text: 'Amount (USD)'
                }
            },
            y2: {
                type: 'linear',
                position: 'right',
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Conversion Rate'
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#E0E0E0',
                    font: {
                        size: 12
                    },
                    usePointStyle: true,
                    filter: function(legendItem, chartData) {
                        // Show all datasets in legend
                        return true;
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.dataset.label || '';
                        if (context.datasetIndex === 2) { // Conversion Rate dataset
                            return `${label}: ${context.raw.toFixed(2)}%`;
                        }
                        return `${label}: ${formatCurrency(context.raw, false)}`;
                    }
                }
            }
        }
    });
}

function createAgeDistributionChart(data) {
    if (!data) return;

    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            label: 'Age Distribution',
            data: Object.values(data),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('ageChart', 'bar', chartData, {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    });
}

// Update createGenderDistributionChart function
function createGenderDistributionChart(data) {
    if (!data) return;

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ChartConfig.colors.bins.slice(0, Object.keys(data).length),
            borderColor: ChartConfig.colors.bins.map(color => color),
            hoverBorderColor: ChartConfig.colors.base.accent3
        }]
    };

    createOrUpdateChart('genderChart', 'pie', chartData, {
        plugins: {
            legend: getLegendConfig(true, 'right', data),
            tooltip: {
                callbacks: {
                    label: (context) => `${context.label}: ${context.raw.toLocaleString()}`
                }
            }
        }
    });
}

function createAgeBinsChart(data) {
    if (!data) return;

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ChartConfig.colors.bins,
            borderColor: ChartConfig.colors.bins.map(color => color),
            hoverBorderColor: ChartConfig.colors.base.accent3
        }]
    };

    createOrUpdateChart('ageBinsChart', 'pie', chartData, {
        plugins: {
            legend: getLegendConfig(true, 'right', data),
            tooltip: {
                callbacks: {
                    label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                }
            }
        }
    });
}

function createPeakHoursChart(data) {
    if (!data) return;

    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            label: 'Number of Purchases',
            data: Object.values(data),
            borderColor: '#bd2ba0',
            backgroundColor: 'rgba(189, 43, 160, 0.1)',
            hoverBorderColor: ChartConfig.colors.base.accent3,
            fill: true,
            tension: 0.4,
            ...ChartConfig.lineDefaults  // Add line defaults
        }]
    };

    createOrUpdateChart('peakHoursChart', 'line', chartData, {
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: function(context) {
                        return `Hour: ${context[0].label}:00`;
                    },
                    label: function(context) {
                        return `Purchases: ${context.raw.toLocaleString()}`;
                    }
                }
            }
        },
        scales: { 
            y: { beginAtZero: true },
            x: { title: { display: true, text: 'Hour of Day' } }
        }
    });
}

// Update createPromoCodeChart function
function createPromoCodeChart(data) {
    if (!data) return;

    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            data: Object.values(data),
            backgroundColor: ChartConfig.colors.bins,
            borderColor: ChartConfig.colors.bins.map(color => color),
            hoverBorderColor: ChartConfig.colors.base.accent3
        }]
    };

    createOrUpdateChart('promoCodeChart', 'doughnut', chartData, {
        plugins: {
            legend: getLegendConfig(true, 'right', data),
            tooltip: {
                callbacks: {
                    label: (context) => `${context.label}: ${context.raw.toLocaleString()}`
                }
            }
        }
    });
}

function createDiscountHistogramChart(data) {
    if (!data) return;

    const chartData = {
        labels: Object.keys(data),
        datasets: [{
            label: 'Number of Transactions',
            data: Object.values(data),
            backgroundColor: ChartConfig.colors.base.accent1,
            borderColor: ChartConfig.colors.base.primary,
            hoverBorderColor: ChartConfig.colors.base.accent3,
            borderWidth: 1
        }]
    };

    createOrUpdateChart('discountHistogramChart', 'bar', chartData, {
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true },
            x: { title: { display: true, text: 'Discount Range' } }
        }
    });
}

function createRFMSegmentsChart(data) {
    if (!data) return;

    // Sort data in descending order
    const sortedEntries = Object.entries(data)
        .sort(([, a], [, b]) => b - a);

    const chartData = {
        labels: sortedEntries.map(([label]) => label),
        datasets: [{
            label: 'Number of Customers',
            data: sortedEntries.map(([, value]) => value),
            ...ChartConfig.barDefaults
        }]
    };

    createOrUpdateChart('rfmSegmentsChart', 'bar', chartData, {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
    });
}

function createVisitVsPurchaseChart(data) { 
    if (!data) return;

    // Define binning ranges with specific color scheme and labels
    const recencyBins = [
        { max: 100, color: '#FF0000', label: 'Very Recent (0-100 days)' },
        { max: 500, color: '#FFA500', label: 'Recent (101-500 days)' },
        { max: 1000, color: '#FFFF00', label: 'Moderate (501-1000 days)' },
        { max: 2000, color: '#00FF00', label: 'Old (1001-2000 days)' },
        { max: Infinity, color: '#00FFFF', label: 'Very Old (2000+ days)' }
    ];

    function getRecencyBinColor(recency) {
        const bin = recencyBins.find(bin => recency <= bin.max);
        return bin ? bin.color : recencyBins[recencyBins.length - 1].color;
    }

    // Generate scatter data with binned colors
    const scatterData = data.Frequency.map((freq, i) => ({
        x: freq,
        y: data.Recency[i],
        backgroundColor: getRecencyBinColor(data.Recency[i])
    }));

    // Compute Regression Line
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, n = scatterData.length;
    scatterData.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate trendline points
    const minX = Math.min(...data.Frequency);
    const maxX = Math.max(...data.Frequency);
    const trendData = [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept }
    ];

    // Create datasets for legend
    const legendDatasets = recencyBins.map(bin => ({
        label: bin.label,
        backgroundColor: bin.color,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderWidth: 0.5,
        data: []
    }));

    const chartData = {
        labels: data.Frequency,
        datasets: [
            {
                label: 'Visit vs Purchase',
                data: scatterData,
                backgroundColor: scatterData.map(d => d.backgroundColor),
                borderColor: 'rgba(255, 255, 255, 0.4)',
                borderWidth: 0.5,
                pointRadius: 2.5,
                pointHoverRadius: 7,
                showLine: false
            },
            {
                label: 'Trend Line',
                data: trendData,
                borderColor: '#FFFFFF',
                borderWidth: 2,
                type: 'line',
                fill: false,
                pointRadius: 0
            },
            ...legendDatasets // Add legend datasets
        ]
    };

    const options = {
        plugins: { 
            legend: { 
                display: true,
                position: 'top',
                labels: {
                    filter: function(legendItem, data) {
                        // Show all legend items including the color bins
                        return true;
                    },
                    generateLabels: function(chart) {
                        // Custom legend labels
                        const datasets = chart.data.datasets;
                        return [
                            ...recencyBins.map((bin, i) => ({
                                text: bin.label,
                                fillStyle: bin.color,
                                strokeStyle: 'rgba(255, 255, 255, 0.4)',
                                lineWidth: 0,
                                hidden: false
                            })),
                            {
                                text: 'Trend Line',
                                fillStyle: 'transparent',
                                strokeStyle: '#FFFFFF',
                                lineWidth: 2,
                                hidden: false
                            }
                        ];
                    }
                }
            },
            tooltip: { 
                callbacks: {
                    label: function(context) {
                        return `Frequency: ${context.raw.x}, Recency: ${context.raw.y} days`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Purchase Frequency', font: { size: 14 } },
                grid: { color: 'rgba(255, 255, 255, 0.2)' }
            },
            y: {
                title: { display: true, text: 'Days Since Last Visit', font: { size: 14 } },
                grid: { color: 'rgba(255, 255, 255, 0.2)' }
            }
        }
    };

    createOrUpdateChart('visitVsPurchaseFrequencyChart', 'scatter', chartData, options);
}

function createSalesByDayChart(data) {
    if (!data) return;

    const days = Object.keys(data);
    const averages = days.map(day => data[day].average);
    const totals = days.map(day => data[day].total);

    const chartData = {
        labels: days,
        datasets: [
            {
                label: 'Average Sales',
                data: averages,
                backgroundColor: ChartConfig.colors.base.accent1,
                borderColor: ChartConfig.colors.base.primary,
                borderWidth: 1,
                yAxisID: 'y1'
            },
            {
                label: 'Total Sales',
                data: totals,
                backgroundColor: ChartConfig.colors.base.accent4,
                borderColor: ChartConfig.colors.base.accent4,
                borderWidth: 1,
                yAxisID: 'y2'
            }
        ]
    };

    createOrUpdateChart('salesByDayChart', 'bar', chartData, {
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                callbacks: getDefaultTooltipCallback()
            }
        },
        scales: {
            y1: {
                ...getDefaultScaleConfig(true),
                position: 'left',
                title: {
                    display: true,
                    text: 'Average Sales (USD)'
                }
            },
            y2: {
                ...getDefaultScaleConfig(true),
                position: 'right',
                title: {
                    display: true,
                    text: 'Total Sales (USD)'
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        }
    });
}

// Helper functions
// Updated formatCurrency function with error handling
function formatCurrency(value, useShortFormat = true) {
    // Handle null, undefined, or empty string
    if (value == null || value === '') return '$0';
    
    // Remove currency symbols and commas if value is string
    if (typeof value === 'string') {
        value = value.replace(/[$,]/g, '');
    }
    
    // Convert to number
    const num = Number(value);
    if (isNaN(num)) return '$0';
    
    if (useShortFormat) {
        return '$' + formatLargeNumber(num);
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(num);
}

// Updated formatLargeNumber function with proper type checking
function formatLargeNumber(value) {
    // Convert to number if string, or return '0' if invalid
    const num = Number(value);
    if (isNaN(num)) return '0';

    const suffixes = [
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'K' },
    ];
    
    for (let { value: numValue, symbol } of suffixes) {
        if (Math.abs(num) >= numValue) {
            return (num / numValue).toFixed(1) + symbol;
        }
    }
    return num.toFixed(0);
}

function generatePieChartLabels(chart, data) {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    return chart.data.labels.map((label, i) => {
        const value = chart.data.datasets[0].data[i];
        const percentage = ((value / total) * 100).toFixed(1);
        return {
            text: `${label}: ${percentage}%`,
            fillStyle: chart.data.datasets[0].backgroundColor[i],
            strokeStyle: chart.data.datasets[0].borderColor[i]
        };
    });
}

function generatePieChartTooltip(context, data) {
    const value = context.raw;
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const percentage = ((value / total) * 100).toFixed(1);
    return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
}

// Initialize store sales table
function initializeStoreSalesTable() {
    let sortedData = [];

    function displayTableData() {
        const tableBody = $('#storeSalesTable tbody');
        tableBody.empty();
        
        sortedData.forEach(([store, sales]) => {
            tableBody.append(`
                <tr>
                    <td>${store}</td>
                    <td>${formatCurrency(sales, true)}</td>
                </tr>
            `);
        });
    }

    // Make sortAndDisplayData accessible to the entire scope
    window.sortAndDisplayData = function(data, sortOrder = 'desc') {
        sortedData = Object.entries(data).sort((a, b) => {
            return sortOrder === 'desc' ? b[1] - a[1] : a[1] - b[1];
        });
        displayTableData();
    }

    // Sort control event handler
    $('#salesSort').on('change', function() {
        const sortOrder = $(this).val();
        if (sortedData.length > 0) {
            sortAndDisplayData(Object.fromEntries(sortedData), sortOrder);
        }
    });

    // Initial sort when new data is loaded
    if (DashboardState.initialData && DashboardState.initialData.graphs.sales_by_store) {
        sortAndDisplayData(DashboardState.initialData.graphs.sales_by_store, 'desc');
    }
}

// Update createAdditionalCharts to use the global sortAndDisplayData
function createAdditionalCharts(data) {
    if (data.sales_by_store) {
        const sortOrder = $('#salesSort').val() || 'desc';
        window.sortAndDisplayData(data.sales_by_store, sortOrder);
    }
}

function createPredictedSalesChart(data) {
    if (!data || !data.monthly_sales) return;

    const monthlyData = data.monthly_sales;
    const labels = monthlyData.map(item => item['Month-Year']);
    const actualSales = monthlyData.map(item => item['Purchase Amount (USD)'] || 0);
    const predictedSales = monthlyData.map(item => item['Predicted'] || 0);

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: 'Actual Sales',
                data: actualSales,
                borderColor: '#bd2ba0',
                backgroundColor: 'rgba(189, 43, 160, 0.1)',
                fill: true,
                ...ChartConfig.lineDefaults  // Add line defaults
            },
            {
                label: 'Predicted Sales',
                data: predictedSales,
                borderColor: '#018786',
                backgroundColor: 'rgba(1, 135, 134, 0.1)',
                fill: true,
                ...ChartConfig.lineDefaults  // Add line defaults
            }
        ]
    };

    createOrUpdateChart('predictedSalesChart', 'line', chartData, {
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Sales (USD)'
                }
            }
        }
    });
}

// Enhanced API Functions
const API = {
    async fetchFilteredData(filters) {
        console.log('Fetching filtered data with:', filters);
        try {
            const response = await fetch('/filter/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN,
                    'Accept': 'application/json',
                },
                body: JSON.stringify(filters || {}),
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received filtered data:', data);
            return data;
        } catch (error) {
            console.error('Error in fetchFilteredData:', error);
            throw error;
        }
    }
};

// Enhanced Event Handlers
function handleFilterApply() {
    console.log('Filter apply clicked');
    const filters = {
        category: document.getElementById('categoryFilter').value,
        location: document.getElementById('locationFilter').value,
        ageRange: $('#ageSlider').slider('values'),
        ratingRange: $('#ratingSlider').slider('values'),
        startDate: document.getElementById('startDateFilter').value,
        endDate: document.getElementById('endDateFilter').value
    };

    console.log('Applying filters:', filters);
    showLoader();

    API.fetchFilteredData(filters)
        .then(data => {
            console.log('Successfully received filtered data');
            if (!data) {
                throw new Error('No data received from server');
            }
            return Promise.all([
                createCharts(data),
                createAdditionalCharts(data),
                createPredictedSalesChart(data)
            ]);
        })
        .then(() => {
            console.log('All charts updated successfully');
        })
        .catch(error => {
            console.error('Error during filter application:', error);
            alert('Error: ' + error.message);
        })
        .finally(() => {
            console.log('Hiding loader');
            hideLoader();
        });
}

// Reset filters handler
function handleFilterReset() {
    // Reset filter values
    $("#categoryFilter").val('');
    $("#locationFilter").val('');
    
    // Reset sliders
    $("#ageSlider").slider("values", [0, 100]);
    $("#ratingSlider").slider("values", [0, 5]);
    $("#ageRange").text("0 - 100");
    $("#ratingRange").text("0 - 5");
    
    // Reset date filters
    $("#startDateFilter").val('');
    $("#endDateFilter").val('');

    // Fetch unfiltered data
    showLoader();
    API.fetchFilteredData({})
        .then(data => {
            console.log('Reset data received:', data);
            if (!data) {
                throw new Error('No data received from server');
            }
            
            // Create charts with proper error handling
            return Promise.all([
                createCharts({ graphs: data }),  // Wrap data in correct structure
                createAdditionalCharts(data),
                data.response ? createPredictedSalesChart(data.response) : null
            ]);
        })
        .catch(error => {
            console.error('Error during filter reset:', error);
            alert('Error resetting filters: ' + error.message);
        })
        .finally(hideLoader);
}

// Add helper function to safely extract numeric values
function extractNumericValue(text) {
    if (!text) return 0;
    // Remove currency symbols, commas, and other non-numeric characters except decimal points
    const numeric = text.replace(/[^0-9.-]/g, '');
    const value = Number(numeric);
    return isNaN(value) ? 0 : value;
}

// Document ready handler
document.addEventListener('DOMContentLoaded', () => {
    // Add this code at the top of your existing DOMContentLoaded handler
    const toggleFilters = document.getElementById('toggleFilters');
    const filters = document.querySelector('.filters');
    
    toggleFilters.addEventListener('click', () => {
        filters.classList.toggle('expanded');
        // Optional: rotate the icon when expanded
        toggleFilters.querySelector('i').style.transform = 
            filters.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    // Get initial data from the Flask template
    const initialDataElement = document.getElementById('initial-data');
    if (initialDataElement) {
        const initialData = JSON.parse(initialDataElement.textContent);
        initializeDashboard(initialData);
    }

    // Event listeners
    document.getElementById('applyFilter')
        .addEventListener('click', handleFilterApply);
    
    document.getElementById('resetFilter')
        .addEventListener('click', handleFilterReset);

    // Add sales trend period change handler
    document.getElementById('salesTrendPeriod')?.addEventListener('change', function(e) {
        const period = e.target.value;
        if (window.salesTrendsData) {
            createSalesTrendChart(window.salesTrendsData, period);
            document.getElementById('salesTrendTooltip').textContent = 
                period === 'month' ? 'Monthly sales trends, showing how sales fluctuate over the course of a year.' 
                                 : 'Yearly sales trends, showing long-term sales performance.';
        }
    });

    // Add theme change observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateChartTheme();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
});

// Enhanced loader functions
function showLoader() {
    console.log('Showing loader');
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    } else {
        console.error('Loader element not found');
    }
}

function hideLoader() {
    console.log('Hiding loader');
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    } else {
        console.error('Loader element not found');
    }
}

// Add timeout to prevent infinite loading
function withTimeout(promise, timeout = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), timeout)
        )
    ]);
}

// Add these helper functions at the top with other helpers
function getDefaultScaleConfig(useShortFormat = true) {
    const { textColor, gridColor } = ChartConfig.getThemeColors();
    return {
        beginAtZero: true,
        ticks: {
            color: textColor,
            callback: function(value) {
                return formatCurrency(value, useShortFormat);
            }
        },
        grid: {
            color: gridColor
        }
    };
}

function getDefaultTooltipCallback(useShortFormat = false) {
    return {
        label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            return label + formatCurrency(context.raw, useShortFormat);
        }
    };
}

// Add a function to update chart themes
function updateChartTheme() {
    const { textColor, gridColor } = ChartConfig.getThemeColors();
    
    DashboardState.charts.forEach(chart => {
        if (!chart) return;
        
        // Update scale colors
        if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = textColor;
                if (scale.grid) scale.grid.color = gridColor;
            });
        }
        
        // Update legend colors
        if (chart.options.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        
        // Update title colors
        if (chart.options.plugins?.title) {
            chart.options.plugins.title.color = textColor;
        }
        
        chart.update('none');
    });
}

async function fetchFilteredData(filters) {
    console.log('Fetching filtered data with:', filters);
    try {
        const response = await fetch('/filter/', {  // Note the trailing slash
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN,
                'Accept': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(filters || {})
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        console.log('Received filtered data:', data);
        return data;
    } catch (error) {
        console.error('Error in fetchFilteredData:', error);
        throw error;
    }
}

// Update handleFilterReset function
function handleFilterReset() {
    // Reset filter values
    $("#categoryFilter").val('');
    $("#locationFilter").val('');
    
    // Reset sliders
    $("#ageSlider").slider("values", [0, 100]);
    $("#ratingSlider").slider("values", [0, 5]);
    $("#ageRange").text("0 - 100");
    $("#ratingRange").text("0 - 5");
    
    // Reset date filters
    $("#startDateFilter").val('');
    $("#endDateFilter").val('');

    // Show loader and fetch unfiltered data
    showLoader();
    fetchFilteredData({})
        .then(data => {
            if (!data) {
                throw new Error('No data received from server');
            }
            
            // Update charts with reset data
            return Promise.all([
                createCharts({ graphs: data }),
                createAdditionalCharts(data),
                data.response ? createPredictedSalesChart(data.response) : null
            ]);
        })
        .catch(error => {
            console.error('Error during filter reset:', error);
            alert('Error resetting filters: ' + error.message);
        })
        .finally(() => {
            hideLoader();
        });
}