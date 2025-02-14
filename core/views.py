import base64
from datetime import time
import shutil
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import pandas as pd
import os
from django.conf import settings
from .preprocessing import DataPreprocessor
from .data_filter import DataFilter
from .graph_generator import GraphGenerator
from .models_ai import SalesPredictor
from .dict_data import synonym_dict
from .report_generator import ReportGenerator
import json
from django.core.serializers.json import DjangoJSONEncoder

# Global variables (consider using Django sessions or database in production)
data = None
pdata = None

def index(request):
    return render(request, 'core/index.html')

@csrf_exempt
def upload_file(request):
    global pdata
    if request.method != 'POST' or 'file' not in request.FILES:
        return JsonResponse({"error": "No file selected or uploaded"}, status=400)

    file = request.FILES['file']
    upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.name)
    
    with open(file_path, 'wb+') as destination:
        for chunk in file.chunks():
            destination.write(chunk)

    try:
        data = pd.read_csv(file_path)
        
        # Process data
        processor = DataPreprocessor(data=data)
        processor.synonym_mapping(synonym_dict)
        processor.remove_duplicate_columns()
        processor.handle_missing_data()
        processor.process_outliers()
        processor.process_dates()

        # Additional processing
        if 'Latitude' in data.columns and 'Longitude' in data.columns and 'Location' not in data.columns:
            processor.add_location_info(latitude_col="Latitude", longitude_col="Longitude")
        if 'Age' in data.columns:
            processor.convert_data_types(column="Age", dtype=int)
            processor.bin_data(column="Age", 
                             bins=[0, 18, 35, 60, 100], 
                             labels=["Child", "Young Adult", "Adult", "Senior"], 
                             new_column_name="Age_bins")
        
        processor.calculate_rfm_metrics()
        pdata = processor.data
        
        # Save processed data
        processed_dir = os.path.join(settings.MEDIA_ROOT, 'processed')
        os.makedirs(processed_dir, exist_ok=True)
        processor.save_data(os.path.join(processed_dir, "processed_dataset.csv"))

        # Generate cards data
        cards = {
            'Total Sales': round(pdata['Purchase Amount (USD)'].sum(), 2) if 'Purchase Amount (USD)' in pdata else 0,
            'Total Transactions': pdata.shape[0],
            'Average Sales': round(pdata['Purchase Amount (USD)'].mean(), 2) if 'Purchase Amount (USD)' in pdata else 0,
            'Average Rating': round(pdata['Review Rating'].mean(), 2) if 'Review Rating' in pdata else 0,
        }

        # Generate graphs
        graph_generator = GraphGenerator(processor.data)
        graphs = graph_generator.generate_graphs()
        if 'Date' in pdata.columns:
            graphs['available_dates'] = sorted(pdata['Date'].dt.strftime('%Y-%m-%d').unique().tolist())

        # Generate predictions
        predictor = SalesPredictor(processor.data)
        monthly_sales = predictor.preprocess_data()
        monthly_sales, next_month_sales = predictor.predict_next_month_sales(monthly_sales)

        response = {
            'monthly_sales': monthly_sales[['Month-Year', 'Purchase Amount (USD)', 'Predicted']].to_dict(orient='records'),
            'next_month_sales': next_month_sales
        }
        response = predictor.process_sales_response(response)

        # Prepare response data
        response_data = {
            'cards': cards,
            'response': response,
            'categories': pdata['Category'].unique().tolist() if 'Category' in pdata.columns else [],
            'locations': pdata['Location'].unique().tolist() if 'Location' in pdata.columns else [],
            'graphs': graphs,
        }

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse(response_data)

        # Serialize the data for the template
        data_json = json.dumps(response_data, cls=DjangoJSONEncoder)
        return render(request, 'core/dashboard.html', {
            'data_json': data_json,
            **response_data
        })

    except Exception as e:
        return JsonResponse({"error": f"Error processing file: {str(e)}"}, status=400)

@csrf_exempt
def filter_data(request):
    global pdata
    if pdata is None:
        return JsonResponse({'error': 'No data uploaded'}, status=400)

    try:
        # Add debug logging
        print(f"Request method: {request.method}")
        print(f"Content type: {request.content_type}")
        print(f"Body: {request.body.decode('utf-8')}")

        # Ensure we're getting POST data
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)

        # Parse JSON data
        try:
            filters = json.loads(request.body)
        except json.JSONDecodeError:
            print("Failed to parse JSON, trying POST data")
            filters = request.POST.dict()

        print(f"Parsed filters: {filters}")

        # Process filters
        filtered_data = pdata.copy()
        data_filter = DataFilter(filtered_data)
        
        if filters.get('category'):
            filtered_data = filtered_data[filtered_data['Category'] == filters['category']]
        
        if filters.get('location'):
            data_filter.filter_by_location(filters['location'])
        
        if filters.get('age_range'):
            data_filter.filter_by_age_range(filters['age_range'])
        
        if filters.get('rating_range'):
            data_filter.filter_by_rating_range(filters['rating_range'])
        
        if filters.get('start_date') and filters.get('end_date'):
            data_filter.filter_by_date_range(filters['start_date'], filters['end_date'])

        filtered_data = data_filter.get_filtered_data()

        if filtered_data.empty:
            return JsonResponse({'error': 'No data matches the selected filters'}, status=404)

        # Generate graphs with filtered data
        generator = GraphGenerator(filtered_data)
        graphs = generator.generate_graphs()
        
        return JsonResponse(graphs, safe=False)

    except Exception as e:
        import traceback
        print(f"Error in filter_data: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def generate_report(request):
    global pdata
    if pdata is None:
        return JsonResponse({'error': 'No data uploaded'}, status=400)

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
        filters = data.get('filters', {})
        cards = data.get('cards', {})
        graphs = data.get('graphs', [])

        # Create reports directory if it doesn't exist
        reports_dir = os.path.join(settings.STATIC_ROOT, 'reports')
        os.makedirs(reports_dir, exist_ok=True)
        
        report_path = os.path.join(reports_dir, 'report.pdf')
        report_generator = ReportGenerator(output_path=report_path)

        try:
            graph_paths = report_generator.decode_and_save_images(graphs)
        except ValueError as e:
            return JsonResponse({'error': f"Failed to decode graphs: {str(e)}"}, status=400)

        report_generator.add_title("Sales Report")
        report_generator.add_cards(cards)
        report_generator.add_filters(filters)
        report_generator.add_graphs(graph_paths)
        report_generator.save_pdf()

        # Return the relative path from STATIC_URL
        relative_path = 'reports/report.pdf'
        return JsonResponse({
            'message': 'Report generated successfully',
            'report_path': relative_path
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Error generating report: {str(e)}'}, status=500)
