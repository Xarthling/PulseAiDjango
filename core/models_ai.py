import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta

class SalesPredictor:
    def __init__(self, data):
        self.data = data
        self.model = LinearRegression()
        self.scaler = StandardScaler()
        
    def preprocess_data(self):
        # Group by month and calculate total sales
        monthly_sales = self.data.groupby(
            self.data['Date'].dt.strftime('%Y-%m')
        )['Purchase Amount (USD)'].sum().reset_index()
        
        # Create time-based features
        monthly_sales['Month-Year'] = pd.to_datetime(monthly_sales['Date'])
        monthly_sales['Month'] = monthly_sales['Month-Year'].dt.month
        monthly_sales['Year'] = monthly_sales['Month-Year'].dt.year
        monthly_sales['TimeIndex'] = range(len(monthly_sales))
        
        return monthly_sales

    def prepare_features(self, monthly_sales):
        X = monthly_sales[['TimeIndex', 'Month', 'Year']].values
        y = monthly_sales['Purchase Amount (USD)'].values
        return train_test_split(X, y, test_size=0.2, random_state=42)

    def train_model(self, X_train, y_train):
        X_train_scaled = self.scaler.fit_transform(X_train)
        self.model.fit(X_train_scaled, y_train)
        return self.model

    def predict_next_month_sales(self, monthly_sales):
        X_train, X_test, y_train, y_test = self.prepare_features(monthly_sales)
        self.train_model(X_train, y_train)
        
        # Prepare next month's features
        last_date = monthly_sales['Month-Year'].iloc[-1]
        next_month = last_date + pd.DateOffset(months=1)
        
        next_month_features = np.array([[
            len(monthly_sales),
            next_month.month,
            next_month.year
        ]])
        
        # Scale features and predict
        next_month_features_scaled = self.scaler.transform(next_month_features)
        next_month_prediction = self.model.predict(next_month_features_scaled)[0]
        
        # Add predictions to historical data
        monthly_sales['Predicted'] = self.model.predict(
            self.scaler.transform(
                monthly_sales[['TimeIndex', 'Month', 'Year']].values
            )
        )
        
        return monthly_sales, next_month_prediction

    def process_sales_response(self, response):
        if not response or 'monthly_sales' not in response:
            return None
            
        monthly_data = response['monthly_sales']
        next_month = response.get('next_month_sales', 0)
        
        # Add confidence intervals and other metrics
        response['metrics'] = {
            'trend': self._calculate_trend(monthly_data),
            'confidence': self._calculate_confidence(),
            'next_month_prediction': next_month
        }
        
        return response

    def _calculate_trend(self, monthly_data):
        if not monthly_data:
            return 0
        
        sales = [item['Purchase Amount (USD)'] for item in monthly_data]
        if len(sales) < 2:
            return 0
            
        return (sales[-1] - sales[0]) / len(sales)

    def _calculate_confidence(self):
        # Simplified confidence calculation
        return 0.95  # 95% confidence interval
