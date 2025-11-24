import React from 'react';
import { FiCheckCircle, FiClock } from 'react-icons/fi';

// Time slots configuration (same as SlotCalendar)
const TIME_SLOTS = [
  { time: '10:00', type: 'male', emoji: '🔵' },
  { time: '10:30', type: 'male', emoji: '🔵' },
  { time: '11:00', type: 'female', emoji: '🩷' },
  { time: '11:30', type: 'female', emoji: '🩷' },
  { time: '12:00', type: 'family', emoji: '💛' },
  { time: '12:30', type: 'family', emoji: '💛' },
  { time: '13:00', type: 'family', emoji: '💛' },
  { time: '13:30', type: 'family', emoji: '💛' },
  { time: '14:00', type: 'family', emoji: '💛' },
  { time: '14:30', type: 'family', emoji: '💛' },
  { time: '15:00', type: 'available', emoji: '' },
  { time: '15:30', type: 'available', emoji: '' },
  { time: '16:00', type: 'available', emoji: '' },
  { time: '16:30', type: 'available', emoji: '' }
];

const WeeklySlotCalendar = ({ weekStart, events, onDayClick, onEventClick }) => {
  // Generate 7 days starting from weekStart
  const getDaysOfWeek = () => {
    const days = [];
    const start = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const days = getDaysOfWeek();

  // Get events for a specific day, time, and slot
  const getEventForDayTimeSlot = (day, time, slot) => {
    if (!events || events.length === 0) return null;
    
    const dayStr = day.toISOString().split('T')[0];
    
    return events.find(event => {
      if (!event.date_booked) return false;
      
      const eventDateStr = new Date(event.date_booked).toISOString().split('T')[0];
      const eventTime = event.time_booked || '';
      const eventSlot = event.booking_slot || 1;
      
      return eventDateStr === dayStr && eventTime === time && eventSlot === slot;
    });
  };

  // Get cell content for compact view
  const getCellContent = (event) => {
    if (!event) return null;
    
    return (
      <div className="text-xs font-medium truncate" title={event.name}>
        {event.is_confirmed ? (
          <FiCheckCircle className="inline-block w-3 h-3 text-green-600" />
        ) : (
          <FiClock className="inline-block w-3 h-3 text-orange-500" />
        )}
      </div>
    );
  };

  // Get cell background color
  const getCellBackground = (event) => {
    if (!event) return 'bg-white';
    
    if (event.has_sale) return 'bg-blue-400';
    if (event.is_confirmed) return 'bg-green-400';
    if (event.booking_status === 'Arrived') return 'bg-red-400';
    if (event.booking_status === 'Left') return 'bg-gray-400';
    
    return 'bg-orange-400';
  };

  return (
    <div className="weekly-slot-calendar-container">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Week of {weekStart.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
      </div>

      {/* Compact Weekly Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Day Headers */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white">
            {/* Top-left corner cell */}
            <div className="bg-gray-50 border-r border-b border-gray-300 p-2 font-semibold text-center text-sm">
              TIME
            </div>
            
            {/* Day headers */}
            {days.map((day, index) => {
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`bg-gray-50 border-r border-b border-gray-300 p-2 text-center cursor-pointer hover:bg-gray-100 transition-colors ${
                    index === 6 ? 'border-r-0' : ''
                  } ${isToday ? 'bg-blue-50 font-bold' : ''}`}
                  onClick={() => onDayClick(day)}
                >
                  <div className="text-xs font-semibold">
                    {day.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div className={`text-lg ${isToday ? 'text-blue-600' : ''}`}>
                    {day.getDate()}
                  </div>
                  <div className="text-xs text-gray-500 flex justify-center gap-1">
                    <span>S1</span>
                    <span>S2</span>
                  </div>
                </div>
              );
            })}

            {/* Time slot rows */}
            {TIME_SLOTS.map((slotConfig, timeIndex) => (
              <React.Fragment key={slotConfig.time}>
                {/* Time label */}
                <div className={`bg-gray-50 border-r border-gray-300 p-2 text-center text-sm font-medium flex items-center justify-center ${
                  timeIndex === TIME_SLOTS.length - 1 ? '' : 'border-b'
                }`}>
                  {slotConfig.time}
                </div>

                {/* Day columns */}
                {days.map((day, dayIndex) => {
                  const slot1Event = getEventForDayTimeSlot(day, slotConfig.time, 1);
                  const slot2Event = getEventForDayTimeSlot(day, slotConfig.time, 2);

                  return (
                    <div
                      key={`${day.toISOString()}-${slotConfig.time}`}
                      className={`border-r border-gray-300 p-1 ${
                        timeIndex === TIME_SLOTS.length - 1 ? '' : 'border-b'
                      } ${dayIndex === 6 ? 'border-r-0' : ''}`}
                    >
                      <div className="grid grid-cols-2 gap-1 h-full">
                        {/* Slot 1 */}
                        <div
                          className={`compact-cell ${getCellBackground(slot1Event)} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center border border-gray-200`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (slot1Event) {
                              onEventClick(slot1Event);
                            } else {
                              onDayClick(day, slotConfig.time, 1);
                            }
                          }}
                          title={slot1Event ? `${slot1Event.name} - Slot 1` : `Book ${slotConfig.time} Slot 1`}
                        >
                          {slot1Event ? getCellContent(slot1Event) : slotConfig.emoji && <span className="text-xs">{slotConfig.emoji}</span>}
                        </div>

                        {/* Slot 2 */}
                        <div
                          className={`compact-cell ${getCellBackground(slot2Event)} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center border border-gray-200`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (slot2Event) {
                              onEventClick(slot2Event);
                            } else {
                              onDayClick(day, slotConfig.time, 2);
                            }
                          }}
                          title={slot2Event ? `${slot2Event.name} - Slot 2` : `Book ${slotConfig.time} Slot 2`}
                        >
                          {slot2Event ? getCellContent(slot2Event) : slotConfig.emoji && <span className="text-xs">{slotConfig.emoji}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center">
              <span className="mr-2">🔵</span>
              <span>Male</span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">🩷</span>
              <span>Female</span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">💛</span>
              <span>Family</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded mr-2"></div>
              <span>Confirmed</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-400 rounded mr-2"></div>
              <span>Unconfirmed</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
              <span>Sale</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklySlotCalendar;

