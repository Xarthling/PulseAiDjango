import numpy as np
import pandas as pd
from itertools import combinations
from collections import defaultdict
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from mlxtend.frequent_patterns import apriori, association_rules
import datetime

class GraphGenerator:
    def __init__(self, data):
        self.data = data.copy()  # Use a copy to prevent modifying the original DataFrame

        self.required_labels = {
            "process_age": ['Age', 'Customer_ID'],
            "generate_peak_purchase_hours": ['Hour'],
            "generate_promo_code_usage": ['Promo_code'],
            "generate_sales_by_store": ['Store Name', 'Purchase Amount (USD)'],
            "generate_sales_by_region": ['Region/Zone', 'Purchase Amount (USD)'],
            "generate_sales_by_month": ['Month', 'Purchase Amount (USD)'],
            "generate_sales_by_store_size": ['Store Size', 'Purchase Amount (USD)'],
            "generate_sales_by_year": ['Year', 'Purchase Amount (USD)'],
            "generate_sales_by_age_bins": ['Age_bins', 'Purchase Amount (USD)'],
            "gender_distribution": ['Gender'],
            "sales_by_category": ['Category', 'Purchase Amount (USD)'],
            "sales_by_location": ['Location', 'Purchase Amount (USD)'],
            "sales_by_season": ['Season', 'Purchase Amount (USD)'],
            "generate_clv_distribution": ['Customer_ID', 'Previous Purchases', 'Frequency'],
            "generate_visit_vs_purchase_frequency": ['Recency', 'Frequency'],
            "generate_cross_sell_upsell_opportunities": ['Previous Purchases', 'Category', 'Purchase Amount (USD)'],
            "generate_top_selling_products": ['Product_id', 'Purchase Amount (USD)'],
            "generate_discount_histogram": ['Discount'],
            "generate_rfm_segments": ['Recency', 'Frequency', 'Monetary', 'Customer_ID'],
            "generate_basket_analysis": ['Customer_ID', 'Product_id'],
            "identify_churned_customers": ['Customer_ID', 'Date'],
            "analyze_discount_impact": ['Discount', 'Purchase Amount (USD)'],
            "generate_sales_by_day": ['Day_of_Week', 'Purchase Amount (USD)']
        }

    def _check_required_labels(self, labels):
        missing = [label for label in labels if label not in self.data.columns]
        if missing:
            print(f"Missing columns: {missing}")
            return False
        return True

    def _group_sum(self, group_by_column, sum_column):
        return self.data.groupby(group_by_column, observed=False)[sum_column].sum().to_dict()

    def _value_counts(self, column, normalize=False, bins=None):
        if bins:
            return self.data[column].value_counts(bins=bins, sort=False).to_dict()
        if normalize:
            return (self.data[column].value_counts(normalize=True) * 100).to_dict()
        return self.data[column].value_counts().to_dict()

    def process_age(self):
        """Bin age into categories and return distribution."""
        if not self._check_required_labels(self.required_labels["process_age"]):
            return None
        min_age, max_age = self.data['Age'].min(), self.data['Age'].max()
        bins = np.linspace(min_age, max_age, 6)  # 5 bins
        labels = [f'{int(bins[i])}-{int(bins[i+1])-1}' for i in range(len(bins) - 1)]
        self.data['Age_Binned_Calculated'] = pd.cut(self.data['Age'], bins=bins, labels=labels, include_lowest=True)
        return self.data['Age_Binned_Calculated'].value_counts().sort_index().to_dict()

    def generate_peak_purchase_hours(self):
        """Return the count of purchases per hour."""
        if not self._check_required_labels(self.required_labels["generate_peak_purchase_hours"]):
            return None
        return self._value_counts('Hour')

    def generate_promo_code_usage(self):
        """Return the percentage usage of promo codes."""
        if not self._check_required_labels(self.required_labels["generate_promo_code_usage"]):
            return None
        return self._value_counts('Promo_code', normalize=True)

    def generate_sales_by_store(self):
        """Return total sales per store."""
        return self._group_sum('Store Name', 'Purchase Amount (USD)') if self._check_required_labels(self.required_labels["generate_sales_by_store"]) else None

    def generate_sales_by_region(self):
        """Return total sales per region/zone."""
        return self._group_sum('Region/Zone', 'Purchase Amount (USD)') if self._check_required_labels(self.required_labels["generate_sales_by_region"]) else None

    def generate_sales_by_month(self):
            """Return total sales per month."""
            if not self._check_required_labels(self.required_labels["generate_sales_by_month"]):
                return None
            sales_by_month = self._group_sum('Month', 'Purchase Amount (USD)')
            # Ensure the dictionary is sorted by month
            return dict(sorted(sales_by_month.items()))

    def generate_sales_by_store_size(self):
        """Return total sales per store size."""
        return self._group_sum('Store Size', 'Purchase Amount (USD)') if self._check_required_labels(self.required_labels["generate_sales_by_store_size"]) else None

    def generate_sales_by_year(self):
        """Return total sales per year."""
        return self._group_sum('Year', 'Purchase Amount (USD)') if self._check_required_labels(self.required_labels["generate_sales_by_year"]) else None

    def generate_sales_by_age_bins(self):
        """Return total sales per age bin."""
        return self._group_sum('Age_bins', 'Purchase Amount (USD)') if self._check_required_labels(self.required_labels["generate_sales_by_age_bins"]) else None

    def generate_top_selling_products(self, top_n=10):
        """Return top N selling products based on purchase amount."""
        if not self._check_required_labels(self.required_labels["generate_top_selling_products"]):
            return None
        top_selling = self.data.groupby('Product_id')['Purchase Amount (USD)'].sum().nlargest(top_n)
        return top_selling.to_dict()

    def generate_clv_distribution(self, bins=10):
        """Calculate Customer Lifetime Value (CLV) and return its distribution."""
        if not self._check_required_labels(self.required_labels["generate_clv_distribution"]):
            return None
        # Assuming CLV = Previous Purchases * Frequency
        self.data['CLV'] = self.data['Previous Purchases'] * self.data['Frequency']
        clv_distribution = self._value_counts('CLV', bins=bins)
        return {str(interval): count for interval, count in clv_distribution.items()}

    def generate_visit_vs_purchase_frequency(self):
        """Return Recency vs Frequency data."""
        if not self._check_required_labels(self.required_labels["generate_visit_vs_purchase_frequency"]):
            return None
        visit_purchase = self.data[['Recency', 'Frequency']].dropna()
        return visit_purchase.to_dict(orient='list')

    def generate_cross_sell_upsell_opportunities(self):
        """Identify cross-sell and upsell opportunities based on category pairs."""
        if not self._check_required_labels(self.required_labels["generate_cross_sell_upsell_opportunities"]):
            return None

        category_pairs = defaultdict(lambda: {"total": 0.0, "contributions": {}})
        grouped = self.data.groupby('Customer_ID')

        for customer_id, group in grouped:
            categories = group['Category'].unique()
            if len(categories) < 2:
                continue
            for cat1, cat2 in combinations(sorted(categories), 2):
                pair = f"{cat1} & {cat2}"
                cat1_amount = group[group['Category'] == cat1]['Purchase Amount (USD)'].sum()
                cat2_amount = group[group['Category'] == cat2]['Purchase Amount (USD)'].sum()
                total_amount = cat1_amount + cat2_amount
                
                category_pairs[pair]["total"] += total_amount
                category_pairs[pair]["contributions"] = {
                    cat1: cat1_amount,
                    cat2: cat2_amount
                }

        # Convert to the format expected by the frontend
        formatted_pairs = {}
        for pair, data in category_pairs.items():
            formatted_pairs[pair] = {
                "total": data["total"],
                "contributions": {
                    cat: amount for cat, amount in data["contributions"].items()
                }
            }

        # Sort by total amount
        sorted_pairs = dict(sorted(formatted_pairs.items(), key=lambda item: item[1]["total"], reverse=True))
        return sorted_pairs

    def generate_discount_histogram(self, bins=10):
        """Return a graph of discounts."""
        if not self._check_required_labels(self.required_labels["generate_discount_histogram"]):
            return None
        discount_hist = self._value_counts('Discount', bins=bins)
        return {str(interval): count for interval, count in discount_hist.items()}

    def generate_gender_distribution(self):
        """Return the distribution of genders."""
        if not self._check_required_labels(self.required_labels["gender_distribution"]):
            return None
        return self._value_counts('Gender')

    def generate_sales_by_category(self):
        """Return total sales per category."""
        if not self._check_required_labels(self.required_labels["sales_by_category"]):
            return None
        return self._group_sum('Category', 'Purchase Amount (USD)')

    def generate_sales_by_location(self):
        """Return total sales per location."""
        if not self._check_required_labels(self.required_labels["sales_by_location"]):
            return None
        return self._group_sum('Location', 'Purchase Amount (USD)')

    def generate_sales_by_season(self):
        """Return total sales per season."""
        if not self._check_required_labels(self.required_labels["sales_by_season"]):
            return None
        return self._group_sum('Season', 'Purchase Amount (USD)')

    def generate_rfm_segments(self, n_clusters=5):
        """Generate RFM segments using clustering."""
        if not self._check_required_labels(self.required_labels["generate_rfm_segments"]):
            return None

        rfm = self.data.groupby('Customer_ID').agg({
            'Recency': 'min',  # Assuming lower recency is better
            'Frequency': 'sum',
            'Monetary': 'sum'
        }).reset_index()

        scaler = StandardScaler()
        rfm_scaled = scaler.fit_transform(rfm[['Recency', 'Frequency', 'Monetary']])

        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        rfm['Segment'] = kmeans.fit_predict(rfm_scaled)

        # Merge segments back to main data if needed
        self.data = self.data.merge(rfm[['Customer_ID', 'Segment']], on='Customer_ID', how='left')

        # Return segment counts
        return rfm['Segment'].value_counts().to_dict()

    def generate_basket_analysis(self, min_support=0.01, min_confidence=0.5):
        """Perform basket analysis to find product associations."""
        if not self._check_required_labels(self.required_labels["generate_basket_analysis"]):
            return None

        basket = self.data.groupby(['Customer_ID', 'Product_id'])['Purchase Amount (USD)'].sum().unstack().fillna(0)
        basket = basket.applymap(lambda x: 1 if x > 0 else 0)

        frequent_itemsets = apriori(basket, min_support=min_support, use_colnames=True)
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence, support_only=False)

        # Convert to dictionary or another suitable format
        return rules.to_dict(orient='records')

    def identify_churned_customers(self, reference_date, period_days=90):
        """Flag customers who haven't made a purchase in the last 'period_days'."""
        if not self._check_required_labels(self.required_labels["identify_churned_customers"]):
            return None
        last_purchase = self.data.groupby('Customer_ID')['Date'].max()
        self.data['Churned'] = self.data['Customer_ID'].apply(
            lambda x: (reference_date - last_purchase[x]).days > period_days
        )
        churned_counts = self.data['Churned'].value_counts().to_dict()
        churned_info = {
            "churned_customers": self.data[self.data['Churned']]['Customer_ID'].unique().tolist(),
            "churned_locations": self.data[self.data['Churned']].groupby('Customer_ID')['Location'].agg(lambda x: x.mode().iloc[0] if not x.mode().empty else 'Unknown').tolist() if 'Location' in self.data.columns else ['Unknown'] * len(self.data[self.data['Churned']]['Customer_ID'].unique()),
            "churned_regions": self.data[self.data['Churned']].groupby('Customer_ID')['Region/Zone'].agg(lambda x: x.mode().iloc[0] if not x.mode().empty else 'Unknown').tolist() if 'Region/Zone' in self.data.columns else ['Unknown'] * len(self.data[self.data['Churned']]['Customer_ID'].unique())
        }
        churned_info["zipped_data"] = list(zip(churned_info["churned_customers"], churned_info["churned_locations"], churned_info["churned_regions"]))
        return {
            "churned_counts": {str(k): v for k, v in churned_counts.items()},
            "churned_customers": churned_info
        }
    
    def analyze_discount_impact(self):
        """Analyze how discounts affect purchase amounts."""
        if not self._check_required_labels(self.required_labels["analyze_discount_impact"]):
            return None
        impact = self.data.groupby('Discount')['Purchase Amount (USD)'].agg(['mean', 'sum', 'count'])
        impact['conversion_rate'] = impact['count'] / self.data['Purchase Amount (USD)'].count()
        return impact.to_dict(orient='index')
    
    def generate_sales_by_day(self):
        """Return average sales per day of the week."""
        if not self._check_required_labels(self.required_labels["generate_sales_by_day"]):
            return None
        
        # Map numeric days to day names
        day_mapping = {
            0: 'Monday',
            1: 'Tuesday', 
            2: 'Wednesday',
            3: 'Thursday',
            4: 'Friday',
            5: 'Saturday',
            6: 'Sunday'
        }

        # Convert numeric days to day names
        if self.data['Day_of_Week'].dtype == 'int64':
            self.data['Day_of_Week'] = self.data['Day'].map(day_mapping)

        # Calculate average sales per day
        daily_sales = self.data.groupby('Day_of_Week')['Purchase Amount (USD)'].agg(['sum', 'mean']).round(2)
        
        # Create result dictionary with both total and average sales
        result = {
            day: {
                'total': daily_sales.loc[day, 'sum'],
                'average': daily_sales.loc[day, 'mean']
            }
            for day in daily_sales.index
        }
        return result

    def generate_graphs(self):
        """Generate all available graphs."""
        current_date = datetime.datetime.now()

        graphs = {
            "age_distribution": self.process_age(),
            "gender_distribution": self.generate_gender_distribution(),
            "sales_by_category": self.generate_sales_by_category(),
            "sales_by_location": self.generate_sales_by_location(),
            "sales_by_season": self.generate_sales_by_season(),
            "sales_by_store": self.generate_sales_by_store(),
            "sales_by_region": self.generate_sales_by_region(),
            "sales_by_month": self.generate_sales_by_month(),
            "sales_by_store_size": self.generate_sales_by_store_size(),
            "sales_by_year": self.generate_sales_by_year(),
            "sales_by_age_bins": self.generate_sales_by_age_bins(),
            "peak_purchase_hours": self.generate_peak_purchase_hours(),
            "promo_code_usage": self.generate_promo_code_usage(),
            "top_selling_products": self.generate_top_selling_products(),
            "clv_distribution": self.generate_clv_distribution(),
            "visit_vs_purchase_frequency": self.generate_visit_vs_purchase_frequency(),
            "cross_sell_upsell_opportunities": self.generate_cross_sell_upsell_opportunities(),
            "discount_histogram": self.generate_discount_histogram(),
            "rfm_segments": self.generate_rfm_segments(), 
            "churned_customers": self.identify_churned_customers(reference_date=current_date),
            "discount_impact": self.analyze_discount_impact(),
            "sales_by_day": self.generate_sales_by_day(),
            # "basket_analysis":self.generate_basket_analysis(),
        }
        return {key: value for key, value in graphs.items() if value is not None}
