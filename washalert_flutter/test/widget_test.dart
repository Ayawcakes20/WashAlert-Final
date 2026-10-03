import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:washalert_flutter/main.dart';
import 'package:washalert_flutter/data/app_state.dart';
import 'package:washalert_flutter/models/booking.dart';
import 'package:washalert_flutter/screens/order_detail_screen.dart';
import 'package:washalert_flutter/theme/app_theme.dart';

void main() {
  testWidgets(
    'customer can sign in and create a booking through all six steps',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const WashAlertApp());
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Try the demo account'));
      await tester.tap(find.text('Try the demo account'));
      await tester.pumpAndSettle();
      expect(find.text('Hello, Demo'), findsOneWidget);
      await tester.tap(find.text('Book Laundry'));
      await tester.pumpAndSettle();
      expect(find.text('Step 1 of 6 / Package'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Step 2 of 6 / Location'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Step 3 of 6 / Extras'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Step 4 of 6 / Schedule'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Step 5 of 6 / Payment'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('Step 6 of 6 / Confirm'), findsOneWidget);
      await tester.ensureVisible(find.byType(CheckboxListTile));
      await tester.tap(find.byType(CheckboxListTile));
      await tester.pump();
      await tester.tap(find.text('Confirm Booking'));
      await tester.pumpAndSettle();
      expect(find.text('Order Details'), findsOneWidget);
      expect(find.text('PHP 290.00'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'price review, simulated payment and pending controls render on a small phone',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final state = AppState()
        ..login(AppState.demoEmail, AppState.demoPassword);
      addTearDown(state.dispose);
      final b = state.createBooking(
        state.newDraft()
          ..mode = ServiceMode.pickUp
          ..paymentMethod = PaymentMethod.gcash,
      );
      await tester.pumpWidget(
        AppScope(
          state: state,
          child: MaterialApp(
            theme: AppTheme.light,
            home: OrderDetailScreen(id: b.trackingId),
          ),
        ),
      );
      await tester.pumpAndSettle();
      state.advanceStatus(b.trackingId);
      state.advanceStatus(b.trackingId);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Confirm Final Price'), 250);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm Final Price'));
      await tester.pumpAndSettle();
      expect(b.status, OrderStatus.priceConfirmed);
      await tester.scrollUntilVisible(find.text('Pay via GCash (Demo)'), 250);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pay via GCash (Demo)'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Simulate Successful GCash Payment'),
        250,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Simulate Successful GCash Payment'));
      await tester.pumpAndSettle();
      expect(b.isPaid, isTrue);
      expect(find.text('Payment Confirmed'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
