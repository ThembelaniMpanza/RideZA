import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/home/HomeScreen'; // adjust path accordingly
import OnboardingScreen from '../screens/Auth/WelcomeScreen'; // adjust path accordingly
import { Header, HeaderShownContext } from '@react-navigation/elements';

const Stack = createStackNavigator();

export default function AppNavigation() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Home" >
                            
                    <Stack.Screen  name="Home" options={{ HeaderShown: false }} component={HomeScreen} />                  
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ HeaderShown: false }} />
                
                                
            </Stack.Navigator>
        </NavigationContainer>
    );
}


// export default function AppNavigation() {
//   return (
//     <NavigationContainer>
//       <Stack.Navigator>
//         {/* your screens */}
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }